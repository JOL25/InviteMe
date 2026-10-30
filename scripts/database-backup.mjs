import {
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
  unlink,
  rmdir,
  readdir,
  realpath,
} from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import path from 'node:path';
import pg from 'pg';
import {
  backupSettings,
  manifestSchema,
  identifier,
  privateDirectoryAllowed,
  restoreName,
} from './backup-rules.mjs';
import { pgTool, requirePostgres17 } from './pg-tools.mjs';
import { migrate } from './migrate.mjs';
async function fingerprint(file) {
  const hash = createHash('sha256');
  let bytes = 0;
  for await (const chunk of createReadStream(file)) {
    hash.update(chunk);
    bytes += chunk.length;
  }
  return { sha256: hash.digest('hex'), bytes };
}
async function inventory(client) {
  const tables = (
    await client.query(
      "select schemaname schema,tablename name from pg_tables where schemaname in('public','private') order by schemaname,tablename",
    )
  ).rows;
  const result = [];
  for (const table of tables)
    result.push({
      ...table,
      rows: (
        await client.query(
          `select count(*)::text rows from ${identifier(table.schema)}.${identifier(table.name)}`,
        )
      ).rows[0].rows,
    });
  return result;
}
async function privateJson(file, data) {
  await writeFile(file, JSON.stringify(data, null, 2) + '\n', {
    flag: 'wx',
    mode: 0o600,
  });
}
async function removeFiles(directory, names) {
  for (const name of names)
    await unlink(path.join(directory, name)).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
  await rmdir(directory).catch((error) => {
    if (!['ENOTEMPTY', 'ENOENT'].includes(error.code)) throw error;
  });
}
export async function createBackup({
  connection = process.env.DATABASE_MIGRATION_URL,
  directory = path.resolve('.local/backups'),
  settings = backupSettings(),
} = {}) {
  if (!connection)
    throw new Error(
      'Falta DATABASE_MIGRATION_URL; el respaldo requiere el dueño de la base.',
    );
  backupSettings(settings);
  await requirePostgres17();
  const requestedParent = privateDirectoryAllowed(directory);
  await mkdir(requestedParent, { recursive: true, mode: 0o700 });
  const parent = privateDirectoryAllowed(
    await realpath(requestedParent),
    await realpath(process.cwd()),
  );
  const destination = await mkdtemp(
    path.join(
      parent,
      `inviteme-${new Date().toISOString().replace(/[:.]/g, '-')}-`,
    ),
  );
  const client = new pg.Client({ connectionString: connection });
  try {
    await client.connect();
    await client.query('begin isolation level repeatable read read only');
    const {
      rows: [source],
    } = await client.query(
      "select current_database() name,current_setting('server_version_num')::int version",
    );
    if (Math.floor(source.version / 10000) !== 17)
      throw new Error('Esta herramienta requiere PostgreSQL 17.');
    const migrations = (
      await client.query(
        'select name,checksum from public.app_migrations order by name',
      )
    ).rows;
    if (
      !migrations.length ||
      !(await client.query("select to_regclass('public.events') table_name"))
        .rows[0].table_name
    )
      throw new Error('La base no corresponde a InviteMe.');
    const snapshot = (
      await client.query('select pg_export_snapshot() snapshot')
    ).rows[0].snapshot;
    const tables = await inventory(client);
    await pgTool(
      'pg_dump',
      [
        '--format=custom',
        '--no-owner',
        '--no-privileges',
        `--snapshot=${snapshot}`,
      ],
      { connection, output: path.join(destination, 'database.dump') },
    );
    await client.query('commit');
    await pgTool('pg_restore', ['--list'], {
      input: path.join(destination, 'database.dump'),
    });
    await privateJson(
      path.join(destination, 'settings.json'),
      backupSettings(settings),
    );
    const manifest = {
      application: 'InviteMe',
      formatVersion: 1,
      postgresMajor: 17,
      createdAt: new Date().toISOString(),
      database: source.name,
      tables,
      migrations,
      files: {
        database: await fingerprint(path.join(destination, 'database.dump')),
        settings: await fingerprint(path.join(destination, 'settings.json')),
      },
    };
    await privateJson(
      path.join(destination, 'manifest.json'),
      manifestSchema.parse(manifest),
    );
    return { directory: destination, manifest };
  } catch (error) {
    await client.query('rollback').catch(() => {});
    await removeFiles(destination, [
      'database.dump',
      'settings.json',
      'manifest.json',
    ]);
    throw error;
  } finally {
    await client.end();
  }
}
export async function readBackup(directory) {
  const root = path.resolve(directory);
  const manifest = manifestSchema.parse(
    JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8')),
  );
  for (const [name, key] of [
    ['database.dump', 'database'],
    ['settings.json', 'settings'],
  ]) {
    const actual = await fingerprint(path.join(root, name));
    const expected = manifest.files[key];
    if (actual.sha256 !== expected.sha256 || actual.bytes !== expected.bytes)
      throw new Error(`El archivo ${name} está incompleto o fue modificado.`);
  }
  const settings = backupSettings(
    JSON.parse(await readFile(path.join(root, 'settings.json'), 'utf8')),
  );
  const supported = new Set(await readdir('database/migrations'));
  if (manifest.migrations.some((item) => !supported.has(item.name)))
    throw new Error(
      'El respaldo usa migraciones que no están en esta versión del proyecto.',
    );
  return { root, manifest, settings };
}
export async function backupAdministrator() {
  if (process.env.BACKUP_ADMIN_URL || process.env.TEST_DATABASE_ADMIN_URL)
    return process.env.BACKUP_ADMIN_URL || process.env.TEST_DATABASE_ADMIN_URL;
  const credentials = JSON.parse(
    await readFile('.local/postgres-credentials.json', 'utf8'),
  );
  return `postgresql://postgres:${credentials.admin}@127.0.0.1:55432/postgres`;
}
export async function removeRestoration(admin, state) {
  if (state.databaseOid) {
    const current = (
      await admin.query('select oid,datdba from pg_database where datname=$1', [
        state.database,
      ])
    ).rows[0];
    if (
      current &&
      (current.oid !== state.databaseOid || current.datdba !== state.ownerOid)
    )
      throw new Error(
        'La base cambió de identidad; no se elimina automáticamente.',
      );
    if (current)
      await admin.query(
        `drop database ${identifier(state.database)} with(force)`,
      );
    state.databaseOid = 0;
  }
  while (state.createdRoles.length) {
    await admin.query(`drop role ${identifier(state.createdRoles[0])}`);
    state.createdRoles.shift();
  }
  if (state.directory)
    await removeFiles(state.directory, ['runtime.json', 'migration.json']);
}
export async function restoreBackup({
  directory,
  database = `inviteme_restore_${Date.now()}_${randomBytes(4).toString('hex')}`,
  adminUrl,
  temporary = false,
}) {
  restoreName(database);
  const backup = await readBackup(directory);
  await requirePostgres17();
  const admin = new pg.Client({
    connectionString: adminUrl || (await backupAdministrator()),
  });
  const state = {
    database,
    owner: `${database}_owner`,
    runtime: `${database}_runtime`,
    createdRoles: [],
    databaseOid: 0,
    ownerOid: 0,
    directory: '',
  };
  let owner;
  try {
    await admin.connect();
    if (
      Math.floor(
        Number(
          (await admin.query('show server_version_num')).rows[0]
            .server_version_num,
        ) / 10000,
      ) !== 17
    )
      throw new Error('El destino debe usar PostgreSQL 17.');
    if (
      (
        await admin.query('select 1 from pg_database where datname=$1', [
          database,
        ])
      ).rowCount ||
      (
        await admin.query(
          'select 1 from pg_roles where rolname=any($1::text[])',
          [[state.owner, state.runtime]],
        )
      ).rowCount
    )
      throw new Error(
        'El nombre de destino o sus roles ya existen. Elige otro: no se sobrescriben datos.',
      );
    const ownerPassword = randomBytes(32).toString('hex'),
      runtimePassword = randomBytes(32).toString('hex');
    for (const [role, password] of [
      [state.owner, ownerPassword],
      [state.runtime, runtimePassword],
    ]) {
      await admin.query(
        `create role ${identifier(role)} login nosuperuser nocreatedb nocreaterole nobypassrls password '${password}'`,
      );
      state.createdRoles.push(role);
    }
    state.ownerOid = (
      await admin.query('select oid from pg_roles where rolname=$1', [
        state.owner,
      ])
    ).rows[0].oid;
    await admin.query(
      `create database ${identifier(database)} owner ${identifier(state.owner)} template template0`,
    );
    state.databaseOid = (
      await admin.query('select oid from pg_database where datname=$1', [
        database,
      ])
    ).rows[0].oid;
    await admin.query(
      `revoke connect,temporary on database ${identifier(database)} from public`,
    );
    await admin.query(
      `grant connect on database ${identifier(database)} to ${identifier(state.owner)},${identifier(state.runtime)}`,
    );
    const base = new URL(adminUrl || (await backupAdministrator()));
    base.pathname = `/${database}`;
    base.username = state.owner;
    base.password = ownerPassword;
    const ownerUrl = base.toString();
    base.username = state.runtime;
    base.password = runtimePassword;
    const runtimeUrl = base.toString();
    await pgTool(
      'pg_restore',
      [
        '--no-owner',
        '--no-privileges',
        '--exit-on-error',
        '--single-transaction',
        `--dbname=${database}`,
      ],
      { connection: ownerUrl, input: path.join(backup.root, 'database.dump') },
    );
    owner = new pg.Client({ connectionString: ownerUrl });
    await owner.connect();
    if (
      JSON.stringify(await inventory(owner)) !==
      JSON.stringify(backup.manifest.tables)
    )
      throw new Error('Los conteos restaurados no coinciden con el respaldo.');
    await owner.query(
      'revoke all on all functions in schema public,private from public; revoke all on all tables in schema public,private from public; revoke all on schema public,private from public',
    );
    await migrate(ownerUrl, state.runtime);
    await owner.query('begin');
    await owner.query('delete from public.app_sessions');
    await owner.query('delete from private.password_resets');
    await owner.query('commit');
    const runtime = new pg.Client({ connectionString: runtimeUrl });
    await runtime.connect();
    try {
      const role = (
        await runtime.query(
          "select rolsuper,rolbypassrls,pg_has_role(current_user,c.relowner,'MEMBER') owner from pg_roles r cross join pg_class c where r.rolname=current_user and c.oid='public.events'::regclass",
        )
      ).rows[0];
      if (
        role.rolsuper ||
        role.rolbypassrls ||
        role.owner ||
        (await runtime.query('select id from public.events')).rowCount
      )
        throw new Error('Los permisos del runtime restaurado no son seguros.');
    } finally {
      await runtime.end();
    }
    const outputRoot = path.resolve('.local/restores');
    await mkdir(outputRoot, { recursive: true, mode: 0o700 });
    const outputDirectory = path.join(outputRoot, database);
    await mkdir(outputDirectory, { mode: 0o700 });
    state.directory = outputDirectory;
    await privateJson(path.join(state.directory, 'runtime.json'), {
      ...backup.settings,
      DATABASE_URL: runtimeUrl,
    });
    await privateJson(path.join(state.directory, 'migration.json'), {
      DATABASE_MIGRATION_URL: ownerUrl,
    });
    await owner.end();
    owner = undefined;
    if (temporary) await removeRestoration(admin, state);
    return {
      database,
      directory: state.directory,
      verified: true,
      tables: backup.manifest.tables.length,
    };
  } catch (error) {
    if (owner) await owner.end();
    await removeRestoration(admin, state);
    throw error;
  } finally {
    await admin.end();
  }
}

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  randomBytes,
  createHash,
  createHmac,
  randomUUID,
  scryptSync,
} from 'node:crypto';
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  appendFile,
  unlink,
  rmdir,
} from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { migrate } from '../../scripts/migrate.mjs';
import {
  backupAdministrator,
  createBackup,
  readBackup,
  restoreBackup,
  removeRestoration,
} from '../../scripts/database-backup.mjs';
import { identifier } from '../../scripts/backup-rules.mjs';
const suffix = randomBytes(5).toString('hex');
const source = `inviteme_backup_test_${suffix}`,
  sourceOwner = `${source}_owner`,
  sourceRuntime = `${source}_runtime`;
const restored = `inviteme_restore_test_${suffix}`;
const settings = {
  NEXT_PUBLIC_SITE_URL: 'http://localhost:3101',
  INVITATION_LINK_SECRET:
    'secret for links "quotes\' and ` chars preserved 2026',
  RSVP_RATE_LIMIT_SECRET: randomBytes(32).toString('hex'),
  PASSWORD_RESET_DELIVERY: 'smtp',
  SMTP_PASSWORD: 'both "quotes\' and ` slash\\ newline\nend',
};
const user = randomUUID(),
  other = randomUUID(),
  event = randomUUID(),
  guest = randomUUID(),
  nonce = randomUUID();
const salt = randomBytes(16).toString('hex');
const password = `scrypt-v1$${salt}$${scryptSync('Password preserved 2026!', salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString('hex')}`;
const token = createHmac('sha256', settings.INVITATION_LINK_SECRET)
  .update(`inviteme:guest:v1:${guest}:${nonce}`)
  .digest('hex');
const tokenHash = createHash('sha256').update(token).digest('hex');
const photo = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6WQAAAABJRU5ErkJggg==',
  'base64',
);
let admin, owner, ownerUrl, adminUrl, directory, backup, result;
async function deleteDatabase(name, ownerRole, runtimeRole, output) {
  const db = (
    await admin.query('select oid,datdba from pg_database where datname=$1', [
      name,
    ])
  ).rows[0];
  const role = (
    await admin.query('select oid from pg_roles where rolname=$1', [ownerRole])
  ).rows[0];
  if (db && role && db.datdba === role.oid)
    await removeRestoration(admin, {
      database: name,
      databaseOid: db.oid,
      ownerOid: role.oid,
      createdRoles: [runtimeRole, ownerRole],
      directory: output || '',
    });
}
before(async () => {
  adminUrl = await backupAdministrator();
  admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  for (const name of [sourceOwner, sourceRuntime])
    await admin.query(
      `create role ${identifier(name)} login nosuperuser nocreatedb nocreaterole nobypassrls password '${randomBytes(24).toString('hex')}'`,
    );
  // Only generated hex passwords enter this isolated test cluster.
  const ownerPassword = randomBytes(32).toString('hex'),
    runtimePassword = randomBytes(32).toString('hex');
  await admin.query(
    `alter role ${identifier(sourceOwner)} password '${ownerPassword}'`,
  );
  await admin.query(
    `alter role ${identifier(sourceRuntime)} password '${runtimePassword}'`,
  );
  await admin.query(
    `create database ${identifier(source)} owner ${identifier(sourceOwner)}`,
  );
  const url = new URL(adminUrl);
  url.pathname = `/${source}`;
  url.username = sourceOwner;
  url.password = ownerPassword;
  ownerUrl = url.toString();
  url.username = sourceRuntime;
  url.password = runtimePassword;
  await migrate(ownerUrl, sourceRuntime);
  owner = new pg.Client({ connectionString: ownerUrl });
  await owner.connect();
  await owner.query(
    'insert into app_users(id,email,password_hash) values($1,$3,$5),($2,$4,$5)',
    [user, other, 'backup-owner@test.local', 'other@test.local', password],
  );
  await owner.query(
    "insert into events(id,owner_id,slug,title,starts_at,venue_name,message,published_at) values($1,$2,'backup-celebration','Celebración conservada','2027-08-20T23:00Z','Jardín','Un recuerdo',now())",
    [event, user],
  );
  const coverPath = `${user}/${event}/abc.png`;
  await owner.query('update events set cover_path=$1 where id=$2', [
    coverPath,
    event,
  ]);
  await owner.query(
    "insert into covers(event_id,path,content_type,bytes) values($1,$2,'image/png',$3)",
    [event, coverPath, photo],
  );
  await owner.query(
    "insert into event_photos(event_id,position,alt_text,caption,content_type,bytes) values($1,0,'Una foto conservada','Recuerdo','image/png',$2)",
    [event, photo],
  );
  await owner.query(
    "insert into event_guests(id,event_id,name,max_party_size,token_nonce,token_hash) values($1,$2,'Invitada conservada',3,$3,$4)",
    [guest, event, nonce, tokenHash],
  );
  await owner.query(
    "insert into rsvps(event_id,guest_id,guest_name,attendance,party_size,note,idempotency_key) values($1,$2,'Invitada conservada',true,2,'Sin gluten',gen_random_uuid())",
    [event, guest],
  );
  await owner.query(
    "insert into event_activities(event_id,title,starts_at) values($1,'Cena','2027-08-21T01:00Z')",
    [event],
  );
  await owner.query(
    "insert into app_sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '7 days')",
    ['a'.repeat(64), user],
  );
  await owner.query(
    "insert into private.password_resets(user_id,token_hash,expires_at) values($1,$2,now()+interval '30 minutes')",
    [user, 'b'.repeat(64)],
  );
  await mkdir('.local', { recursive: true });
  directory = await mkdtemp(path.resolve('.local/backup-tests-'));
});
after(async () => {
  if (owner) await owner.end();
  if (admin) {
    await deleteDatabase(
      restored,
      `${restored}_owner`,
      `${restored}_runtime`,
      result?.directory,
    );
    await deleteDatabase(source, sourceOwner, sourceRuntime);
    await admin.end();
  }
  if (backup) {
    for (const file of ['database.dump', 'settings.json', 'manifest.json'])
      await unlink(path.join(backup.directory, file)).catch(() => {});
    await rmdir(backup.directory);
  }
  if (directory) await rmdir(directory);
});
test('crea un respaldo íntegro con configuración y todas las tablas', async () => {
  backup = await createBackup({ connection: ownerUrl, directory, settings });
  const checked = await readBackup(backup.directory);
  assert.deepEqual(checked.settings, settings);
  assert.ok(
    checked.manifest.tables.some(
      (table) => table.name === 'event_photos' && table.rows === '1',
    ),
  );
  assert.ok(
    checked.manifest.tables.some(
      (table) =>
        table.schema === 'private' &&
        table.name === 'password_resets' &&
        table.rows === '1',
    ),
  );
  assert.equal(checked.settings.DATABASE_URL, undefined);
  assert.equal(checked.settings.DATABASE_MIGRATION_URL, undefined);
});
test('restaura en otra base con fotos, cuentas, itinerario y enlaces conservados', async () => {
  result = await restoreBackup({
    directory: backup.directory,
    database: restored,
    adminUrl,
  });
  const config = JSON.parse(
    await readFile(path.join(result.directory, 'runtime.json'), 'utf8'),
  );
  const migration = JSON.parse(
    await readFile(path.join(result.directory, 'migration.json'), 'utf8'),
  );
  assert.equal(config.SMTP_PASSWORD, settings.SMTP_PASSWORD);
  assert.equal(config.INVITATION_LINK_SECRET, settings.INVITATION_LINK_SECRET);
  assert.equal(config.DATABASE_MIGRATION_URL, undefined);
  const restoredOwner = new pg.Client({
    connectionString: migration.DATABASE_MIGRATION_URL,
  });
  await restoredOwner.connect();
  try {
    assert.equal(
      (
        await restoredOwner.query(
          'select password_hash from app_users where id=$1',
          [user],
        )
      ).rows[0].password_hash,
      password,
    );
    for (const table of ['covers', 'event_photos'])
      assert.deepEqual(
        (
          await restoredOwner.query(
            `select bytes from ${table} where event_id=$1`,
            [event],
          )
        ).rows[0].bytes,
        photo,
      );
    assert.equal(
      (
        await restoredOwner.query('select note from rsvps where event_id=$1', [
          event,
        ])
      ).rows[0].note,
      'Sin gluten',
    );
    assert.equal(
      (
        await restoredOwner.query(
          'select title from event_activities where event_id=$1',
          [event],
        )
      ).rows[0].title,
      'Cena',
    );
    assert.equal(
      (await restoredOwner.query('select count(*)::int n from app_sessions'))
        .rows[0].n,
      0,
    );
    assert.equal(
      (
        await restoredOwner.query(
          'select count(*)::int n from private.password_resets',
        )
      ).rows[0].n,
      0,
    );
  } finally {
    await restoredOwner.end();
  }
});
test('la copia mantiene RLS, funciones públicas acotadas y el rol de aplicación restringido', async () => {
  const config = JSON.parse(
    await readFile(path.join(result.directory, 'runtime.json'), 'utf8'),
  );
  const runtime = new pg.Client({ connectionString: config.DATABASE_URL });
  await runtime.connect();
  try {
    assert.equal((await runtime.query('select * from events')).rowCount, 0);
    assert.equal(
      (
        await runtime.query(
          "select has_function_privilege(current_user,'private.open_session(uuid,text)','EXECUTE') allowed",
        )
      ).rows[0].allowed,
      false,
    );
    assert.equal(
      (
        await runtime.query('select * from resolve_guest_invitation($1,$2)', [
          'backup-celebration',
          tokenHash,
        ])
      ).rows[0].name,
      'Invitada conservada',
    );
    await runtime.query('begin');
    await runtime.query("select set_config('app.user_id',$1,true)", [user]);
    assert.equal(
      (await runtime.query('select id from events')).rows[0].id,
      event,
    );
    await runtime.query('rollback');
    await assert.rejects(runtime.query('select * from app_users'));
  } finally {
    await runtime.end();
  }
});
test('rechaza un destino existente sin modificarlo ni tocar la base original', async () => {
  await assert.rejects(
    restoreBackup({
      directory: backup.directory,
      database: restored,
      adminUrl,
    }),
    /ya existen/,
  );
  assert.equal(
    (await owner.query('select count(*)::int n from app_sessions')).rows[0].n,
    1,
  );
  assert.equal(
    (
      await admin.query(
        'select count(*)::int n from pg_database where datname=$1',
        [restored],
      )
    ).rows[0].n,
    1,
  );
});
test('detecta corrupción del archivo antes de crear bases o roles', async () => {
  const file = path.join(backup.directory, 'database.dump');
  const original = await readFile(file);
  const target = `inviteme_restore_bad_${suffix}`;
  try {
    await appendFile(file, 'corruption');
    await assert.rejects(
      restoreBackup({
        directory: backup.directory,
        database: target,
        adminUrl,
      }),
      /modificado/,
    );
    assert.equal(
      (
        await admin.query('select 1 from pg_database where datname=$1', [
          target,
        ])
      ).rowCount,
      0,
    );
  } finally {
    await writeFile(file, original);
  }
});
test('verifica otra restauración temporal y elimina exclusivamente sus roles y su copia', async () => {
  const target = `inviteme_restore_verify_${suffix}`;
  const verification = await restoreBackup({
    directory: backup.directory,
    database: target,
    adminUrl,
    temporary: true,
  });
  assert.equal(verification.verified, true);
  assert.equal(
    (await admin.query('select 1 from pg_database where datname=$1', [target]))
      .rowCount,
    0,
  );
  assert.equal(
    (
      await admin.query(
        'select 1 from pg_roles where rolname=any($1::text[])',
        [[`${target}_owner`, `${target}_runtime`]],
      )
    ).rowCount,
    0,
  );
});
test('detecta cambios en la configuración privada antes de restaurar', async () => {
  const file = path.join(backup.directory, 'settings.json');
  const original = await readFile(file);
  try {
    await appendFile(file, ' ');
    await assert.rejects(
      readBackup(backup.directory),
      /settings.json.*modificado/,
    );
  } finally {
    await writeFile(file, original);
  }
});
test('un fallo de pg_restore elimina solo la copia recién creada y sus roles', async () => {
  const file = path.join(backup.directory, 'database.dump'),
    manifestFile = path.join(backup.directory, 'manifest.json');
  const original = await readFile(file),
    originalManifest = await readFile(manifestFile);
  const target = `inviteme_restore_failed_${suffix}`;
  try {
    const corrupt = Buffer.from('PGDMP invalid archive');
    await writeFile(file, corrupt);
    const manifest = JSON.parse(originalManifest.toString());
    manifest.files.database = {
      sha256: createHash('sha256').update(corrupt).digest('hex'),
      bytes: corrupt.length,
    };
    await writeFile(manifestFile, JSON.stringify(manifest));
    await assert.rejects(
      restoreBackup({
        directory: backup.directory,
        database: target,
        adminUrl,
      }),
      /pg_restore/,
    );
    assert.equal(
      (
        await admin.query('select 1 from pg_database where datname=$1', [
          target,
        ])
      ).rowCount,
      0,
    );
    assert.equal(
      (
        await admin.query(
          'select 1 from pg_roles where rolname=any($1::text[])',
          [[`${target}_owner`, `${target}_runtime`]],
        )
      ).rowCount,
      0,
    );
    assert.equal(
      (await owner.query('select count(*)::int n from events')).rows[0].n,
      1,
    );
  } finally {
    await writeFile(file, original);
    await writeFile(manifestFile, originalManifest);
  }
});

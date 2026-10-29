import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import pg from 'pg';
import { grantRuntime } from './runtime-grants.mjs';

export async function migrate(
  connectionString = process.env.DATABASE_MIGRATION_URL ||
    process.env.DATABASE_URL,
  runtimeRole,
) {
  if (!connectionString)
    throw new Error('Configura DATABASE_URL antes de migrar.');
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query('begin');
    await client.query('select pg_advisory_xact_lock(47891322)');
    await client.query(
      'create table if not exists app_migrations(name text primary key, checksum text not null, applied_at timestamptz not null default now())',
    );
    for (const name of (await readdir('database/migrations'))
      .filter((n) => n.endsWith('.sql'))
      .sort()) {
      const rawSql = await readFile(`database/migrations/${name}`, 'utf8');
      const sql = rawSql.replace(/\r\n/g, '\n');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const { rows } = await client.query(
        'select checksum from app_migrations where name=$1',
        [name],
      );
      if (rows.length) {
        const rawChecksum = createHash('sha256').update(rawSql).digest('hex');
        if (rows[0].checksum !== checksum && rows[0].checksum !== rawChecksum)
          throw new Error(`La migración aplicada ${name} cambió.`);
        if (rows[0].checksum !== checksum)
          await client.query(
            'update app_migrations set checksum=$1 where name=$2',
            [checksum, name],
          );
        continue;
      }
      await client.query(sql);
      await client.query(
        'insert into app_migrations(name,checksum) values($1,$2)',
        [name, checksum],
      );
      console.log(`Aplicada: ${name}`);
    }
    const role =
      runtimeRole ||
      (process.env.DATABASE_URL
        ? decodeURIComponent(new URL(process.env.DATABASE_URL).username)
        : undefined);
    if (role) await grantRuntime(client, role);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    await client.end();
  }
}
if (process.argv[1]?.endsWith('migrate.mjs')) await migrate();

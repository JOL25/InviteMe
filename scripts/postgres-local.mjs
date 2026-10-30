import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, access, unlink } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { migrate } from './migrate.mjs';

// This helper manages only this checkout's cluster, never the Windows service.
const local = path.resolve('.local');
const data = path.join(local, 'postgres');
const bin =
  process.env.PG_BIN ||
  (process.platform === 'win32'
    ? 'C:/Program Files/PostgreSQL/17/bin'
    : '/usr/lib/postgresql/17/bin');
const port = 55432;
async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}
function run(tool, args, allowFailure = false) {
  const result = spawnSync(
    path.join(bin, tool + (process.platform === 'win32' ? '.exe' : '')),
    args,
    {
      encoding: 'utf8',
      windowsHide: true,
      stdio: tool === 'pg_ctl' ? 'ignore' : 'pipe',
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure)
    throw new Error(result.stderr || result.stdout || `${tool} falló`);
  return result.status;
}
await mkdir(local, { recursive: true });
const command = process.argv[2] || 'start';
if (command === 'stop' || command === 'status') {
  const status = run(
    'pg_ctl',
    ['-D', data, command, ...(command === 'stop' ? ['-m', 'fast', '-w'] : [])],
    true,
  );
  console.log(
    command === 'status'
      ? status === 0
        ? 'PostgreSQL local activo.'
        : 'PostgreSQL local detenido.'
      : 'PostgreSQL local detenido.',
  );
  process.exit(status === 0 ? 0 : 1);
}
const credentialsPath = path.join(local, 'postgres-credentials.json');
let credentials;
if (await exists(credentialsPath))
  credentials = JSON.parse(await readFile(credentialsPath, 'utf8'));
else {
  credentials = {
    admin: randomBytes(32).toString('hex'),
    app: randomBytes(32).toString('hex'),
  };
  await writeFile(credentialsPath, JSON.stringify(credentials), {
    mode: 0o600,
    flag: 'wx',
  });
}
if (!credentials.runtime) {
  credentials.runtime = randomBytes(32).toString('hex');
  await writeFile(credentialsPath, JSON.stringify(credentials), {
    mode: 0o600,
  });
}
if (!(await exists(path.join(data, 'PG_VERSION')))) {
  const pw = path.join(local, 'init-password');
  await writeFile(pw, credentials.admin, { mode: 0o600 });
  try {
    run('initdb', [
      '-D',
      data,
      '-U',
      'postgres',
      '--encoding=UTF8',
      '--locale=C',
      '--auth=scram-sha-256',
      `--pwfile=${pw}`,
    ]);
    await writeFile(
      path.join(data, 'postgresql.auto.conf'),
      `listen_addresses = '127.0.0.1'\nport = ${port}\n`,
    );
  } finally {
    await unlink(pw);
  }
}
if (run('pg_ctl', ['-D', data, 'status'], true) !== 0)
  run('pg_ctl', [
    '-D',
    data,
    '-l',
    path.join(local, 'postgres.log'),
    '-w',
    'start',
  ]);
const admin = new pg.Client({
  host: '127.0.0.1',
  port,
  user: 'postgres',
  password: credentials.admin,
  database: 'postgres',
});
await admin.connect();
try {
  if (
    !(await admin.query("select 1 from pg_roles where rolname='inviteme_app'"))
      .rowCount
  ) {
    // Password is generated hex; never sourced from user input or logged.
    await admin.query(
      `create role inviteme_app login nosuperuser nocreatedb nocreaterole password '${credentials.app}'`,
    );
  }
  if (
    !(await admin.query("select 1 from pg_database where datname='inviteme'"))
      .rowCount
  )
    await admin.query('create database inviteme owner inviteme_app');
  if (
    !(
      await admin.query(
        "select 1 from pg_roles where rolname='inviteme_runtime'",
      )
    ).rowCount
  )
    await admin.query(
      `create role inviteme_runtime login nosuperuser nocreatedb nocreaterole nobypassrls password '${credentials.runtime}'`,
    );
} finally {
  await admin.end();
}
const url = `postgresql://inviteme_app:${credentials.app}@127.0.0.1:${port}/inviteme`;
const runtimeUrl = `postgresql://inviteme_runtime:${credentials.runtime}@127.0.0.1:${port}/inviteme`;
const envPath = path.resolve('.env.local');
let env = (await exists(envPath)) ? await readFile(envPath, 'utf8') : '';
// Preserve unrelated settings and old cloud credentials without displaying them.
env = env.replace(/^DATABASE_(?:MIGRATION_)?URL=.*\r?\n?/gm, '');
if (!/^NEXT_PUBLIC_SITE_URL=.+/m.test(env))
  env += '\nNEXT_PUBLIC_SITE_URL=http://localhost:3101\n';
if (!/^RSVP_RATE_LIMIT_SECRET=.+/m.test(env))
  env += `\nRSVP_RATE_LIMIT_SECRET=${randomBytes(32).toString('hex')}\n`;
if (!/^INVITATION_LINK_SECRET=.+/m.test(env))
  env += `\nINVITATION_LINK_SECRET=${randomBytes(32).toString('hex')}\n`;
if (!/^PASSWORD_RESET_DELIVERY=.+/m.test(env))
  env += '\nPASSWORD_RESET_DELIVERY=local\n';
await migrate(url, 'inviteme_runtime');
await writeFile(envPath, env.trimEnd() + `\nDATABASE_URL=${runtimeUrl}\n`, {
  mode: 0o600,
});
await writeFile(
  path.resolve('.env.database'),
  `DATABASE_MIGRATION_URL=${url}\n`,
  { mode: 0o600 },
);
console.log(
  `InviteMe listo en PostgreSQL local (127.0.0.1:${port}). Credenciales guardadas en archivos ignorados por Git.`,
);

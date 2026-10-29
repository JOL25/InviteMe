import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import pg from 'pg';
import { migrate } from './migrate.mjs';
let adminUrl = process.env.TEST_DATABASE_ADMIN_URL;
if (!adminUrl) {
  const credentials = JSON.parse(
    await readFile('.local/postgres-credentials.json', 'utf8'),
  );
  adminUrl = `postgresql://postgres:${credentials.admin}@127.0.0.1:55432/postgres`;
}
const name = `inviteme_test_${randomBytes(8).toString('hex')}`;
const runtimePassword = randomBytes(32).toString('hex');
const ownerPassword = randomBytes(32).toString('hex');
const runtimeRole = `${name}_app`;
const admin = new pg.Client({ connectionString: adminUrl });
await admin.connect();
let exitCode = 1;
try {
  await admin.query(
    `create role ${name} login nosuperuser nocreatedb nocreaterole password '${ownerPassword}'`,
  );
  await admin.query(
    `create role ${runtimeRole} login nosuperuser nocreatedb nocreaterole nobypassrls password '${runtimePassword}'`,
  );
  await admin.query(`create database ${name} owner ${name}`);
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  url.username = name;
  url.password = ownerPassword;
  const migrationUrl = url.toString();
  await migrate(migrationUrl, runtimeRole);
  url.username = runtimeRole;
  url.password = runtimePassword;
  exitCode = await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        'node_modules/@playwright/test/cli.js',
        'test',
        '-c',
        'playwright.local.config.ts',
      ],
      {
        stdio: 'inherit',
        windowsHide: true,
        env: {
          ...process.env,
          DATABASE_URL: url.toString(),
          DATABASE_MIGRATION_URL: migrationUrl,
          RSVP_RATE_LIMIT_SECRET: randomBytes(32).toString('hex'),
          NEXT_PUBLIC_SITE_URL: 'http://localhost:3102',
          TURNSTILE_SECRET_KEY: '',
          NEXT_PUBLIC_TURNSTILE_SITE_KEY: '',
        },
      },
    );
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 1));
  });
} finally {
  await admin.query(`drop database if exists ${name} with (force)`);
  await admin.query(`drop role if exists ${name}`);
  await admin.query(`drop role if exists ${runtimeRole}`);
  await admin.end();
}
process.exitCode = exitCode;

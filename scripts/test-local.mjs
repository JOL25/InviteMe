import { readFile } from 'node:fs/promises';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import pg from 'pg';
import { migrate } from './migrate.mjs';
import { startTestSMTP } from './test-smtp.mjs';
const smtpMode = process.argv.includes('--smtp');
const testArguments = process.argv
  .slice(2)
  .filter((value) => value !== '--smtp');
let adminUrl = process.env.TEST_DATABASE_ADMIN_URL;
if (!adminUrl) {
  const credentials = JSON.parse(
    await readFile('.local/postgres-credentials.json', 'utf8'),
  );
  adminUrl = `postgresql://postgres:${credentials.admin}@127.0.0.1:55432/postgres`;
}
const name = `inviteme_test_${randomBytes(8).toString('hex')}`;
const localRoot = path.resolve('.local');
const mailDirectory = path.join(localRoot, `${name}_mail`);
const runtimePassword = randomBytes(32).toString('hex');
const ownerPassword = randomBytes(32).toString('hex');
const runtimeRole = `${name}_app`;
const admin = new pg.Client({ connectionString: adminUrl });
await admin.connect();
let exitCode = 1;
let smtp;
try {
  await mkdir(mailDirectory, { recursive: true });
  if (smtpMode) smtp = await startTestSMTP(mailDirectory);
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
        smtpMode ? 'playwright.smtp.config.ts' : 'playwright.local.config.ts',
        ...testArguments,
      ],
      {
        stdio: 'inherit',
        windowsHide: true,
        env: {
          ...process.env,
          DATABASE_URL: url.toString(),
          DATABASE_MIGRATION_URL: migrationUrl,
          RSVP_RATE_LIMIT_SECRET: randomBytes(32).toString('hex'),
          INVITATION_LINK_SECRET: randomBytes(32).toString('hex'),
          PASSWORD_RESET_DELIVERY: smtpMode ? 'smtp-test' : 'local',
          SMTP_HOST: '127.0.0.1',
          SMTP_PORT: smtp ? String(smtp.port) : '',
          SMTP_USER: '',
          SMTP_PASSWORD: '',
          SMTP_FROM: 'recovery@inviteme.test',
          PASSWORD_RESET_OUTBOX: mailDirectory,
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
  if (smtp) await smtp.close();
  await admin.query(`drop database if exists ${name} with (force)`);
  await admin.query(`drop role if exists ${name}`);
  await admin.query(`drop role if exists ${runtimeRole}`);
  await admin.end();
  const relative = path.relative(localRoot, mailDirectory);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative))
    throw new Error('Ruta de buzón de prueba inválida.');
  await rm(mailDirectory, { recursive: true, force: true });
}
process.exitCode = exitCode;

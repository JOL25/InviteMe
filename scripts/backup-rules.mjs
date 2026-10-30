import path from 'node:path';
import { z } from 'zod';
export const settingsKeys = [
  'NEXT_PUBLIC_SITE_URL',
  'INVITATION_LINK_SECRET',
  'RSVP_RATE_LIMIT_SECRET',
  'PASSWORD_RESET_DELIVERY',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'SMTP_FROM',
  'TURNSTILE_SECRET_KEY',
  'NEXT_PUBLIC_TURNSTILE_SITE_KEY',
];
/** @param {Record<string, string | undefined>} [env] @returns {Record<string, string>} */
export function backupSettings(env = process.env) {
  const settings = Object.fromEntries(
    settingsKeys
      .filter((key) => env[key] !== undefined)
      .map((key) => [key, env[key]]),
  );
  if (
    Object.values(settings).some(
      (value) => typeof value !== 'string' || value.includes('\0'),
    )
  )
    throw new Error('La configuración contiene valores inválidos.');
  for (const key of ['INVITATION_LINK_SECRET', 'RSVP_RATE_LIMIT_SECRET'])
    if (typeof settings[key] !== 'string' || settings[key].length < 32)
      throw new Error(
        `Falta ${key}: no se puede conservar la configuración de enlaces.`,
      );
  return settings;
}
const digest = z.object({
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  bytes: z.number().int().positive(),
});
export const manifestSchema = z.object({
  application: z.literal('InviteMe'),
  formatVersion: z.literal(1),
  postgresMajor: z.literal(17),
  createdAt: z.iso.datetime(),
  database: z.string().min(1),
  tables: z
    .array(
      z.object({
        schema: z.enum(['public', 'private']),
        name: z.string().min(1).max(63),
        rows: z.string().regex(/^\d+$/),
      }),
    )
    .min(1),
  migrations: z
    .array(
      z.object({
        name: z.string().regex(/^\d+_[a-z0-9_]+\.sql$/),
        checksum: z.string().regex(/^[a-f0-9]{64}$/),
      }),
    )
    .min(1),
  files: z.object({ database: digest, settings: digest }),
});
export function restoreName(value) {
  if (!/^inviteme_restore_[a-z0-9_]{1,34}$/.test(value))
    throw new Error(
      'Usa un nombre nuevo con prefijo inviteme_restore_ y hasta 50 caracteres.',
    );
  return value;
}
export const identifier = (value) => '"' + value.replaceAll('"', '""') + '"';
export function privateDirectoryAllowed(directory, workspace = process.cwd()) {
  const relative = path.relative(
    path.resolve(workspace),
    path.resolve(directory),
  );
  if (
    !relative ||
    (relative !== '..' &&
      !relative.startsWith('..' + path.sep) &&
      !path.isAbsolute(relative) &&
      relative.split(path.sep)[0] !== '.local')
  )
    throw new Error(
      'Dentro del proyecto, los respaldos deben guardarse bajo .local.',
    );
  return path.resolve(directory);
}
export function connectionEnvironment(connectionString) {
  let url;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error('La conexión PostgreSQL no es válida.');
  }
  const database = decodeURIComponent(url.pathname.slice(1));
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !/^[a-zA-Z0-9_-]{1,63}$/.test(database)
  )
    throw new Error(
      'La conexión debe indicar una base PostgreSQL con nombre simple.',
    );
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('PG')),
  );
  Object.assign(env, {
    PGHOST: url.hostname.replace(/^\[|\]$/g, ''),
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: database,
    PGCONNECT_TIMEOUT: '10',
    PGAPPNAME: 'InviteMe backup',
  });
  for (const [query, key] of [
    ['sslmode', 'PGSSLMODE'],
    ['sslrootcert', 'PGSSLROOTCERT'],
    ['sslcert', 'PGSSLCERT'],
    ['sslkey', 'PGSSLKEY'],
  ])
    if (url.searchParams.has(query)) env[key] = url.searchParams.get(query);
  return { env, database };
}

/**
 * @param {Record<string, string>} config
 * @param {string} directory
 * @param {number} [port]
 * @param {Record<string, string | undefined>} [parent]
 * @returns {Record<string, string | undefined>}
 */
export function previewEnvironment(
  config,
  directory,
  port = 3103,
  parent = process.env,
) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error('El puerto debe estar entre 1024 y 65535.');
  const { database } = connectionEnvironment(config.DATABASE_URL);
  restoreName(database);
  const settings = backupSettings(config);
  const originalHost = new URL(
    settings.NEXT_PUBLIC_SITE_URL || 'http://localhost:3101',
  ).hostname;
  const host = originalHost === '127.0.0.1' ? 'localhost' : '127.0.0.1';
  const env = {
    ...parent,
    ...settings,
    DATABASE_URL: config.DATABASE_URL,
    NEXT_PUBLIC_SITE_URL: `http://${host}:${port}`,
    PASSWORD_RESET_DELIVERY: 'local',
    PASSWORD_RESET_OUTBOX: path.join(path.resolve(directory), 'mail'),
    TURNSTILE_SECRET_KEY: '',
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: '',
  };
  for (const key of Object.keys(env))
    if (
      key.startsWith('SMTP_') ||
      key.startsWith('PG') ||
      [
        'DATABASE_MIGRATION_URL',
        'BACKUP_ADMIN_URL',
        'TEST_DATABASE_ADMIN_URL',
      ].includes(key)
    )
      delete env[key];
  for (const key of [
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASSWORD',
    'SMTP_FROM',
  ])
    env[key] = '';
  return env;
}

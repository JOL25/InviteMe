import { it, expect } from 'vitest';
import path from 'node:path';
import {
  backupSettings,
  restoreName,
  privateDirectoryAllowed,
  connectionEnvironment,
  previewEnvironment,
} from '../../scripts/backup-rules.mjs';
const settings = {
  INVITATION_LINK_SECRET: 'a'.repeat(64),
  RSVP_RATE_LIMIT_SECRET: 'b'.repeat(64),
  NEXT_PUBLIC_SITE_URL: 'http://localhost:3101',
  PASSWORD_RESET_DELIVERY: 'smtp',
  SMTP_PASSWORD: 'secret with "quotes\' and `backtick',
};
it('conserva secretos de enlaces y correo sin copiar credenciales administrativas', () => {
  const saved = backupSettings({
    ...settings,
    DATABASE_URL: 'private',
    DATABASE_MIGRATION_URL: 'owner',
    BACKUP_ADMIN_URL: 'admin',
  });
  expect(saved).toEqual(settings);
  expect(() => backupSettings({})).toThrow();
});
it('rechaza configuraciones con valores no representables en el entorno', () => {
  expect(() =>
    backupSettings({ ...settings, SMTP_PASSWORD: 'invalid\0value' }),
  ).toThrow();
});
it('la restauración requiere nombres aislados y rechaza SQL o nombres de otras bases', () => {
  expect(restoreName('inviteme_restore_prueba')).toBe(
    'inviteme_restore_prueba',
  );
  for (const name of [
    'inviteme',
    'postgres',
    'other_project',
    'inviteme_restore_x;drop database inviteme',
    'inviteme_restore_' + 'x'.repeat(50),
  ])
    expect(() => restoreName(name)).toThrow();
});
it('impide respaldos dentro de carpetas públicas o versionadas del proyecto', () => {
  expect(privateDirectoryAllowed(path.resolve('.local/backups'))).toBe(
    path.resolve('.local/backups'),
  );
  for (const target of ['public/backups', 'docs/backups', '..backups', '.'])
    expect(() => privateDirectoryAllowed(path.resolve(target))).toThrow();
});
it('transmite la contraseña al cliente PG mediante entorno, sin introducirla en argumentos', () => {
  const result = connectionEnvironment(
    'postgresql://owner:p%23ass@127.0.0.1:55432/inviteme?sslmode=require',
  );
  expect(result.database).toBe('inviteme');
  expect(result.env.PGPASSWORD).toBe('p#ass');
  expect(result.env.PGSSLMODE).toBe('require');
  expect(() => connectionEnvironment('not a connection')).toThrow();
});
it('la vista restaurada solo usa su runtime y desactiva envíos externos y CAPTCHA', () => {
  const env = previewEnvironment(
    {
      ...settings,
      DATABASE_URL:
        'postgresql://inviteme_restore_demo_runtime:secret@localhost/inviteme_restore_demo',
    },
    '.local/restores/demo',
    3103,
    {
      DATABASE_MIGRATION_URL: 'owner',
      BACKUP_ADMIN_URL: 'admin',
      TEST_DATABASE_ADMIN_URL: 'admin',
      PGPASSWORD: 'admin',
    },
  );
  expect(env.NEXT_PUBLIC_SITE_URL).toBe('http://127.0.0.1:3103');
  expect(env.PASSWORD_RESET_DELIVERY).toBe('local');
  expect(env.SMTP_PASSWORD).toBe('');
  expect(env.INVITATION_LINK_SECRET).toBe(settings.INVITATION_LINK_SECRET);
  for (const key of [
    'DATABASE_MIGRATION_URL',
    'BACKUP_ADMIN_URL',
    'TEST_DATABASE_ADMIN_URL',
    'PGPASSWORD',
  ])
    expect(env).not.toHaveProperty(key);
});

import { afterEach, it, expect, vi } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { recoveryResetSchema } from '@/lib/recovery-rules';
import {
  localRecoveryEnabled,
  localMailDirectory,
  localMessages,
  writeLocalMessage,
} from '../../scripts/local-mail.mjs';
const directory = path.resolve('.local', `unit-mail-${randomUUID()}`);
afterEach(async () => {
  vi.unstubAllEnvs();
  const relative = path.relative(path.resolve('.local'), directory);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative))
    throw new Error('Invalid test directory');
  await rm(directory, { recursive: true, force: true });
});
it('exige un token completo, contraseña válida y confirmación coincidente', () => {
  const value = {
    token: 'a'.repeat(64),
    password: 'Nueva contraseña 2026!',
    confirmation: 'Nueva contraseña 2026!',
  };
  expect(recoveryResetSchema.safeParse(value).success).toBe(true);
  for (const change of [
    { token: 'invalid' },
    { password: 'corta' },
    { confirmation: 'Distinta' },
    { password: 'x'.repeat(129) },
  ])
    expect(recoveryResetSchema.safeParse({ ...value, ...change }).success).toBe(
      false,
    );
});
it('la entrega local exige configuración explícita y un host de loopback', () => {
  vi.stubEnv('PASSWORD_RESET_DELIVERY', 'local');
  for (const url of [
    'http://localhost:3101',
    'http://127.0.0.1:3102',
    'http://[::1]:3101',
  ]) {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', url);
    expect(localRecoveryEnabled()).toBe(true);
  }
  for (const url of [
    'https://inviteme.example',
    'http://localhost.example',
    'file:///tmp',
    'bad-url',
  ]) {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', url);
    expect(localRecoveryEnabled()).toBe(false);
  }
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3101');
  vi.stubEnv('PASSWORD_RESET_DELIVERY', '');
  expect(localRecoveryEnabled()).toBe(false);
});
it('el buzón solo admite directorios dentro de .local', () => {
  vi.stubEnv('PASSWORD_RESET_OUTBOX', path.resolve('outside-mail'));
  expect(() => localMailDirectory()).toThrow();
  vi.stubEnv('PASSWORD_RESET_OUTBOX', directory);
  expect(localMailDirectory()).toBe(directory);
});
it('escribe la entrega privada, ignora archivos ajenos y limpia mensajes caducados', async () => {
  vi.stubEnv('PASSWORD_RESET_DELIVERY', 'local');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3101');
  vi.stubEnv('PASSWORD_RESET_OUTBOX', directory);
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, `${randomUUID()}.json`),
    JSON.stringify({ expires_at: '2000-01-01T00:00:00Z' }),
  );
  await writeFile(path.join(directory, 'unrelated.txt'), 'not a message');
  await writeFile(
    path.join(directory, `${randomUUID()}.json`),
    JSON.stringify({ expires_at: '2099-01-01T00:00:00Z' }),
  );
  await writeLocalMessage({
    to: 'test@test.local',
    kind: 'reset',
    link: `http://localhost:3101/reset-password#token=${'a'.repeat(64)}`,
  });
  const messages = await localMessages();
  expect(messages).toHaveLength(1);
  expect(messages[0].to).toBe('test@test.local');
  expect(messages[0].kind).toBe('reset');
  vi.stubEnv('PASSWORD_RESET_DELIVERY', '');
  await expect(
    writeLocalMessage({ to: 'test@test.local', kind: 'changed' }),
  ).rejects.toThrow();
});

import { test, expect, type Page } from '@playwright/test';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { simpleParser } from 'mailparser';
import pg from 'pg';
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_MIGRATION_URL,
});
const directory = process.env.PASSWORD_RESET_OUTBOX!;
const emails: string[] = [];
let client = 0;
const headers = () => ({
  origin: 'http://localhost:3102',
  'x-forwarded-for': `198.51.100.${++client}`,
});
type Capture = {
  kind: 'delivered' | 'rejected' | 'held';
  to: string[];
  raw?: string;
};
async function captures(email: string, kind = 'delivered') {
  const result: Capture[] = [];
  for (const file of await readdir(directory)) {
    if (!/^[a-f0-9-]{36}\.json$/.test(file)) continue;
    try {
      const message = JSON.parse(
        await readFile(path.join(directory, file), 'utf8'),
      ) as Capture;
      if (message.kind === kind && message.to.includes(email))
        result.push(message);
    } catch {
      /* A capture is still being written. */
    }
  }
  return result;
}
async function register(page: Page) {
  const email = `smtp-${randomUUID()}@test.local`;
  emails.push(email);
  await page.goto('/register');
  await page.getByLabel('Correo electrónico').fill(email);
  await page
    .getByLabel('Contraseña', { exact: true })
    .fill('Contraseña SMTP para probar 2026!');
  await page
    .getByRole('button', { name: 'Crear mi cuenta', exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard$/);
  return email;
}
test.afterAll(async () => {
  await pool.query('delete from app_users where email=any($1::text[])', [
    emails,
  ]);
  await pool.end();
});
test('SMTP local recibe el enlace y la notificación, sin exponer tokens ni credenciales en la web', async ({
  page,
  request,
}) => {
  const email = await register(page);
  await page.goto('/forgot-password');
  await expect(
    page.getByText('npm run mail:local', { exact: true }),
  ).toHaveCount(0);
  await page.getByLabel('Correo electrónico').fill(email.toUpperCase());
  await page
    .getByRole('button', { name: 'Solicitar recuperación', exact: true })
    .click();
  await expect(page.locator('p[role="status"]')).toContainText('por correo');
  await expect.poll(async () => (await captures(email)).length).toBe(1);
  const mail = await simpleParser((await captures(email))[0].raw!);
  expect(mail.subject).toBe('InviteMe: recupera tu cuenta');
  expect(mail.from?.value[0].address).toBe('recovery@inviteme.test');
  expect(
    Array.isArray(mail.to)
      ? mail.to[0].value[0].address
      : mail.to?.value[0].address,
  ).toBe(email);
  const link =
    /http:\/\/localhost:3102\/reset-password#token=[a-f0-9]{64}/.exec(
      mail.text!,
    )![0];
  const token = new URL(link).hash.slice('#token='.length);
  expect(mail.html).toContain('Elegir nueva contraseña');
  const stored = (
    await pool.query(
      'select token_hash from private.password_resets r join app_users u on u.id=r.user_id where u.email=$1',
      [email],
    )
  ).rows[0].token_hash;
  expect(stored).toBe(createHash('sha256').update(token).digest('hex'));
  const html = await (await request.get('/forgot-password')).text();
  for (const privateValue of [
    token,
    email,
    'SMTP_PASSWORD',
    'recovery@inviteme.test',
  ])
    expect(html).not.toContain(privateValue);
  const password = 'Nueva contraseña por SMTP 2026!';
  await page.goto(link);
  await page.getByLabel('Nueva contraseña', { exact: true }).fill(password);
  await page
    .getByLabel('Repetir nueva contraseña', { exact: true })
    .fill(password);
  await page
    .getByRole('button', { name: 'Guardar nueva contraseña', exact: true })
    .click();
  await expect(page.locator('p[role="status"]')).toContainText(
    'fue actualizada',
  );
  await expect.poll(async () => (await captures(email)).length).toBe(2);
  const messages = await Promise.all(
    (await captures(email)).map((capture) => simpleParser(capture.raw!)),
  );
  const changed = messages.find(
    (message) => message.subject === 'InviteMe: contraseña actualizada',
  )!;
  expect(changed.text).toContain('sesiones anteriores');
  expect(changed.text).not.toContain(password);
  expect(changed.text).not.toContain(token);
  expect(
    (
      await pool.query(
        'select s.* from app_sessions s join app_users u on u.id=s.user_id where u.email=$1',
        [email],
      )
    ).rows,
  ).toHaveLength(0);
});
test('la respuesta no espera al SMTP y un rechazo mantiene la misma respuesta para cuentas conocidas y desconocidas', async ({
  page,
  request,
}) => {
  const email = await register(page);
  const control = (value: object) =>
    writeFile(path.join(directory, 'smtp-control.json'), JSON.stringify(value));
  const ask = (address: string) =>
    request.post('/api/auth/forgot-password', {
      headers: headers(),
      data: { email: address },
    });
  try {
    await control({ hold: true });
    const known = await ask(email);
    expect(known.status()).toBe(200);
    const unknown = await ask(`unknown-${randomUUID()}@test.local`);
    expect(unknown.status()).toBe(200);
    expect(await known.json()).toEqual(await unknown.json());
    expect(await captures(email)).toHaveLength(0);
    await expect
      .poll(async () => (await captures(email, 'held')).length)
      .toBe(1);
    await control({ hold: false });
    await expect.poll(async () => (await captures(email)).length).toBe(1);
    await control({ rejectRecipient: email });
    const rejected = await ask(email);
    expect(rejected.status()).toBe(200);
    expect(await rejected.json()).toEqual(await unknown.json());
    await expect
      .poll(async () => (await captures(email, 'rejected')).length)
      .toBe(1);
    expect(await captures(email)).toHaveLength(1);
    await control({});
    expect((await ask(email)).status()).toBe(200);
    await expect.poll(async () => (await captures(email)).length).toBe(2);
  } finally {
    await control({});
  }
});

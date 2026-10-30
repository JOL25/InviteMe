import { test, expect, type Page } from '@playwright/test';
import { randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { localMessages } from '../../scripts/local-mail.mjs';
import { verifyPassword } from '../../src/lib/passwords';
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_MIGRATION_URL,
});
const emails: string[] = [];
const original = 'Mi contraseña original 2026!';
const replacement = 'Mi contraseña recuperada 2026!';
let counter = 0;
const headers = () => ({
  origin: 'http://localhost:3102',
  'x-forwarded-for': `192.0.2.${++counter}`,
});
async function register(page: Page) {
  const email = `recovery-${randomUUID()}@test.local`;
  emails.push(email);
  await page.goto('/register');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(original);
  await page
    .getByRole('button', { name: 'Crear mi cuenta', exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard$/);
  return email;
}
async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page
    .getByRole('button', { name: 'Entrar a mi cuenta', exact: true })
    .click();
}
const mail = async (email: string) =>
  (await localMessages()).filter(
    (message) => message.to === email && message.kind === 'reset',
  );
test.afterAll(async () => {
  await pool.query('delete from app_users where email=any($1::text[])', [
    emails,
  ]);
  await pool.end();
});

test('recuperación local completa, confirmación, sesiones revocadas y datos conservados', async ({
  page,
  browser,
  request,
}) => {
  const email = await register(page);
  await page.goto('/dashboard/events/new');
  await page
    .getByLabel('Título del evento')
    .fill('Evento que debe conservarse');
  await page.getByLabel('Fecha y hora local').fill('2027-08-20T18:00');
  await page.getByLabel('Lugar', { exact: true }).fill('Jardín local');
  await page
    .getByRole('button', { name: 'Crear mi invitación', exact: true })
    .click();
  await expect(page).toHaveURL(/\/events\/[a-f0-9-]+\/edit/);
  const second = await browser.newContext({ baseURL: 'http://localhost:3102' });
  const recovery = await browser.newContext({
    baseURL: 'http://localhost:3102',
  });
  try {
    const otherSession = await second.newPage();
    await login(otherSession, email, original);
    await expect(otherSession).toHaveURL(/\/dashboard$/);
    const guest = await recovery.newPage();
    await guest.goto('/login');
    await guest
      .getByRole('link', { name: 'Olvidé mi contraseña', exact: true })
      .click();
    await expect(guest).toHaveURL(/\/forgot-password$/);
    await guest.getByLabel('Correo electrónico').fill(email.toUpperCase());
    await guest
      .getByRole('button', { name: 'Solicitar recuperación', exact: true })
      .click();
    await expect(guest.locator('p[role="status"]')).toContainText(
      'Si existe una cuenta',
    );
    const messages = await mail(email);
    expect(messages).toHaveLength(1);
    const link = messages[0].link as string;
    const token = new URL(link).hash.slice('#token='.length);
    expect(new URL(link).search).toBe('');
    const row = (
      await pool.query(
        'select token_hash from private.password_resets r join app_users u on u.id=r.user_id where u.email=$1',
        [email],
      )
    ).rows[0];
    expect(row.token_hash).toBe(
      createHash('sha256').update(token).digest('hex'),
    );
    const terminal = execFileSync(
      process.execPath,
      ['scripts/mail-local.mjs', '--email', email],
      { encoding: 'utf8', windowsHide: true },
    );
    expect(terminal).toContain(link);
    expect(terminal).not.toContain(original);
    const html = await (await request.get('/reset-password')).text();
    expect(html).not.toContain(token);
    expect(html).not.toContain(email);
    for (const route of ['forgot-password', 'reset-password']) {
      const trace = JSON.parse(
        await readFile(
          `.next/server/app/api/auth/${route}/route.js.nft.json`,
          'utf8',
        ),
      ) as { files: string[] };
      expect(
        trace.files.some((file) => {
          const normalized = file.replaceAll('\\', '/');
          return (
            normalized.includes('/.local/') || normalized.includes('/.env')
          );
        }),
      ).toBe(false);
    }
    const urls: string[] = [];
    guest.on('request', (req) => {
      if (req.url().includes('/api/')) urls.push(req.url());
    });
    await guest.goto(link);
    for (const width of [320, 714, 1280]) {
      await guest.setViewportSize({ width, height: 900 });
      expect(
        await guest.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await guest
      .locator('.auth-panel')
      .screenshot({ path: '.local/password-recovery-preview.png' });
    await guest
      .getByLabel('Nueva contraseña', { exact: true })
      .fill(replacement);
    await guest
      .getByLabel('Repetir nueva contraseña', { exact: true })
      .fill('No coincide con la anterior 2026!');
    await guest
      .getByRole('button', { name: 'Guardar nueva contraseña', exact: true })
      .click();
    await expect(guest.locator('p[role="alert"]')).toContainText(
      'no coinciden',
    );
    await guest
      .getByLabel('Repetir nueva contraseña', { exact: true })
      .fill(replacement);
    await guest
      .getByRole('button', { name: 'Guardar nueva contraseña', exact: true })
      .click();
    await expect(guest.locator('p[role="status"]')).toContainText(
      'sesiones anteriores se cerraron',
    );
    expect(
      (
        await pool.query(
          'select s.* from app_sessions s join app_users u on u.id=s.user_id where u.email=$1',
          [email],
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (await recovery.cookies()).some(
        (cookie) => cookie.name === 'inviteme_session',
      ),
    ).toBe(false);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
    await otherSession.goto('/dashboard');
    await expect(otherSession).toHaveURL(/\/login/);
    const updated = (
      await pool.query('select password_hash from app_users where email=$1', [
        email,
      ])
    ).rows[0].password_hash;
    expect(await verifyPassword(replacement, updated)).toBe(true);
    expect(await verifyPassword(original, updated)).toBe(false);
    expect(
      (await localMessages()).some(
        (message) => message.to === email && message.kind === 'changed',
      ),
    ).toBe(true);
    await guest
      .getByRole('link', { name: 'Iniciar sesión', exact: true })
      .click();
    await login(guest, email, original);
    await expect(guest.locator('p[role="alert"]')).toHaveText(
      'Correo o contraseña incorrectos.',
    );
    await login(guest, email, replacement);
    await expect(guest).toHaveURL(/\/dashboard$/);
    await expect(
      guest.getByText('Evento que debe conservarse', { exact: true }),
    ).toBeVisible();
    expect(urls.every((url) => !url.includes(token))).toBe(true);
    const reused = await request.post('/api/auth/reset-password', {
      headers: headers(),
      data: { token, password: replacement, confirmation: replacement },
    });
    expect(reused.status()).toBe(400);
  } finally {
    await second.close();
    await recovery.close();
  }
});

test('no enumera cuentas, limita solicitudes y rechaza enlaces sustituidos o caducados', async ({
  page,
  request,
}) => {
  const email = await register(page);
  const ask = (address: string) =>
    request.post('/api/auth/forgot-password', {
      headers: headers(),
      data: { email: address },
    });
  const known = await ask(email),
    unknown = await ask(`unknown-${randomUUID()}@test.local`);
  expect(known.status()).toBe(200);
  expect(unknown.status()).toBe(200);
  expect(await known.json()).toEqual(await unknown.json());
  const first = (await mail(email))[0].link as string;
  await ask(email);
  const second = (await mail(email))[0].link as string;
  expect(second).not.toBe(first);
  const reset = (link: string) =>
    request.post('/api/auth/reset-password', {
      headers: headers(),
      data: {
        token: new URL(link).hash.slice('#token='.length),
        password: replacement,
        confirmation: replacement,
      },
    });
  expect((await reset(first)).status()).toBe(400);
  await pool.query(
    "update private.password_resets r set expires_at=now()-interval '1 second' from app_users u where r.user_id=u.id and u.email=$1",
    [email],
  );
  expect((await reset(second)).status()).toBe(400);
  expect((await ask(email)).status()).toBe(200);
  expect(await mail(email)).toHaveLength(3);
  const lastHash = (
    await pool.query(
      'select token_hash from private.password_resets r join app_users u on u.id=r.user_id where u.email=$1',
      [email],
    )
  ).rows[0].token_hash;
  expect((await ask(email)).status()).toBe(200);
  expect(await mail(email)).toHaveLength(3);
  expect(
    (
      await pool.query(
        'select token_hash from private.password_resets r join app_users u on u.id=r.user_id where u.email=$1',
        [email],
      )
    ).rows[0].token_hash,
  ).toBe(lastHash);
  for (const path of [
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
  ]) {
    expect((await request.post(path, { data: {} })).status()).toBe(403);
    expect(
      (
        await request.post(path, {
          headers: {
            origin: 'http://localhost:3102',
            'content-type': 'text/plain',
          },
          data: '{}',
        })
      ).status(),
    ).toBe(415);
    expect(
      (
        await request.post(path, {
          headers: {
            origin: 'http://localhost:3102',
            'content-type': 'application/json',
          },
          data: 'x'.repeat(4097),
        })
      ).status(),
    ).toBe(400);
  }
  for (let i = 0; i < 10; i++) {
    const response = await request.post('/api/auth/reset-password', {
      headers: {
        origin: 'http://localhost:3102',
        'x-forwarded-for': '203.0.113.240',
      },
      data: {
        token: '0'.repeat(64),
        password: replacement,
        confirmation: replacement,
      },
    });
    expect(response.status()).toBe(400);
  }
  const limited = await request.post('/api/auth/reset-password', {
    headers: {
      origin: 'http://localhost:3102',
      'x-forwarded-for': '203.0.113.240',
    },
    data: {
      token: '0'.repeat(64),
      password: replacement,
      confirmation: replacement,
    },
  });
  expect(limited.status()).toBe(429);
  expect(limited.headers()['retry-after']).toBe('900');
});

test('dos consumos simultáneos solo cambian una vez y no resucitan una sesión con la contraseña vieja', async ({
  page,
  request,
}) => {
  const email = await register(page);
  const user = (
    await pool.query('select id,password_hash from app_users where email=$1', [
      email,
    ])
  ).rows[0];
  expect(
    (
      await request.post('/api/auth/forgot-password', {
        headers: headers(),
        data: { email },
      })
    ).status(),
  ).toBe(200);
  const token = new URL((await mail(email))[0].link as string).hash.slice(
    '#token='.length,
  );
  const choices = [
    'Contraseña concurrente uno 2026!',
    'Contraseña concurrente dos 2026!',
  ];
  const responses = await Promise.all(
    choices.map((password) =>
      request.post('/api/auth/reset-password', {
        headers: headers(),
        data: { token, password, confirmation: password },
      }),
    ),
  );
  expect(responses.map((response) => response.status()).sort()).toEqual([
    200, 400,
  ]);
  const winner = responses.findIndex((response) => response.status() === 200);
  const stored = (
    await pool.query('select password_hash from app_users where id=$1', [
      user.id,
    ])
  ).rows[0].password_hash;
  expect(await verifyPassword(choices[winner], stored)).toBe(true);
  expect(await verifyPassword(choices[1 - winner], stored)).toBe(false);
  expect(
    (
      await pool.query(
        'select private.open_checked_session($1,$2,$3) allowed',
        [user.id, 'f'.repeat(64), user.password_hash],
      )
    ).rows[0].allowed,
  ).toBe(false);
  expect(
    (await pool.query('select * from app_sessions where user_id=$1', [user.id]))
      .rows,
  ).toHaveLength(0);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
});

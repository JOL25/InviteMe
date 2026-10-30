import { test, expect, type Page } from '@playwright/test';
import { randomUUID, createHash } from 'node:crypto';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_MIGRATION_URL,
});
const emails: string[] = [];
async function createEvent(page: Page, capacity = '3') {
  const email = `invitees-${randomUUID()}@test.local`;
  emails.push(email);
  await page.goto('/register');
  await page.getByLabel('Correo electrónico').fill(email);
  await page
    .getByLabel('Contraseña', { exact: true })
    .fill('Invitados locales para pruebas 2026!');
  await page
    .getByRole('button', { name: 'Crear mi cuenta', exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/dashboard/events/new');
  await page.getByLabel('Título del evento').fill('Lista para celebrar');
  await page.getByLabel('Fecha y hora local').fill('2027-08-20T18:00');
  await page.getByLabel('Lugar', { exact: true }).fill('Jardín local');
  await page.getByLabel('Cupo total', { exact: false }).fill(capacity);
  await page
    .getByRole('button', { name: 'Crear mi invitación', exact: true })
    .click();
  await expect(page).toHaveURL(/\/events\/[a-f0-9-]+\/edit/);
  const id = /\/events\/([^/]+)\//.exec(page.url())![1];
  return (await pool.query('select id,slug from events where id=$1', [id]))
    .rows[0] as { id: string; slug: string };
}
async function add(page: Page, name: string, quota = '1') {
  const form = page.locator('.add-invitee');
  await form.getByLabel('Nombre del invitado').fill(name);
  await form
    .getByLabel('Correo de contacto')
    .fill(`${name.toLowerCase()}@test.local`);
  await form
    .getByLabel('Cupo de esta invitación', { exact: false })
    .selectOption(quota);
  await form
    .getByRole('button', { name: 'Añadir invitado', exact: true })
    .click();
  const card = page.getByRole('article', {
    name: `Invitación de ${name}`,
    exact: true,
  });
  await expect(card).toBeVisible();
  return card.getByLabel(`Enlace individual de ${name}`).inputValue();
}
const rawToken = (url: string) => new URL(url).hash.slice('#invitado='.length);
test.afterAll(async () => {
  await pool.query('delete from app_users where email=any($1::text[])', [
    emails,
  ]);
  await pool.end();
});

test('lista, enlaces privados, cupos, respuestas únicas y pendientes reales', async ({
  page,
  browser,
  request,
}) => {
  const event = await createEvent(page);
  const roster = `/dashboard/events/${event.id}/invitees`;
  await page.goto(roster);
  const ana = await add(page, 'Ana', '2');
  const bruno = await add(page, 'Bruno');
  const carla = await add(page, 'Carla');
  const stats = page.locator('.invitee-stats strong');
  await expect(stats).toHaveText(['3', '3', '0', '0']);
  await page.reload();
  await expect(page.getByLabel('Enlace individual de Ana')).toHaveValue(ana);
  expect(new URL(ana).search).toBe('');
  expect(
    (
      await pool.query(
        'select token_hash from event_guests where event_id=$1 and name=$2',
        [event.id, 'Ana'],
      )
    ).rows[0].token_hash,
  ).toBe(createHash('sha256').update(rawToken(ana)).digest('hex'));
  const resolve = (token: string) =>
    request.post('/api/invitations/resolve', {
      headers: { origin: 'http://localhost:3102' },
      data: { slug: event.slug, token },
    });
  expect((await resolve(rawToken(ana))).status()).toBe(404);
  await page.goto(`/dashboard/events/${event.id}/edit`);
  await page
    .getByRole('button', { name: 'Publicar invitación ↗', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Volver a borrador', exact: true }),
  ).toBeVisible();
  expect(
    (
      await request.post('/api/invitations/resolve', {
        data: { slug: event.slug, token: rawToken(ana) },
      })
    ).status(),
  ).toBe(403);
  const resolved = await resolve(rawToken(ana));
  expect(resolved.status()).toBe(200);
  expect(Object.keys(await resolved.json()).sort()).toEqual([
    'attendance',
    'id',
    'max_party_size',
    'name',
    'party_size',
  ]);
  const html = await (await request.get(`/i/${event.slug}`)).text();
  for (const privateValue of ['ana@test.local', 'Bruno', rawToken(ana)])
    expect(html).not.toContain(privateValue);
  let apiNumber = 0;
  const submit = (token: string | undefined, overrides = {}) =>
    request.post('/api/rsvp', {
      headers: {
        origin: 'http://localhost:3102',
        'x-forwarded-for': `192.0.2.${++apiNumber}`,
      },
      data: {
        slug: event.slug,
        inviteToken: token,
        guestName: 'Nombre alterado',
        guestEmail: '',
        attendance: true,
        partySize: 1,
        note: '',
        website: '',
        idempotencyKey: randomUUID(),
        ...overrides,
      },
    });
  expect((await submit(rawToken(ana), { partySize: 3 })).status()).toBe(409);
  const visitor = await browser.newContext({
    baseURL: 'http://localhost:3102',
    viewport: { width: 320, height: 740 },
  });
  try {
    const invitation = await visitor.newPage();
    const urls: string[] = [];
    invitation.on('request', (req) => {
      if (req.url().includes('/api/')) urls.push(req.url());
    });
    await invitation.goto(ana);
    await expect(
      invitation.getByLabel('Tu nombre', { exact: true }),
    ).toHaveValue('Ana');
    await expect(
      invitation.getByLabel('Tu nombre', { exact: true }),
    ).toHaveAttribute('readonly', '');
    await expect(
      invitation.locator('select[name="partySize"] option'),
    ).toHaveCount(2);
    await invitation
      .getByRole('link', { name: 'Confirmar asistencia', exact: false })
      .click();
    expect(invitation.url()).toBe(ana);
    await invitation
      .getByLabel('Personas que asistirán, incluyéndote')
      .selectOption('2');
    await invitation
      .getByRole('button', { name: 'Enviar mi respuesta', exact: true })
      .click();
    await expect(invitation).toHaveURL(/\/thanks\?confirmed=1/);
    expect(urls.every((url) => !url.includes(rawToken(ana)))).toBe(true);
    await invitation.goto(ana);
    await expect(
      invitation.getByText('Ana, ya recibimos tu respuesta.'),
    ).toBeVisible();
    await expect(invitation.locator('.rsvp-form')).toHaveCount(0);
    expect((await submit(rawToken(ana), { partySize: 2 })).status()).toBe(200);
    expect((await submit(rawToken(ana), { attendance: false })).status()).toBe(
      409,
    );
    expect((await submit(undefined, { guestName: 'Bruno' })).status()).toBe(
      201,
    );
    expect((await submit(rawToken(bruno))).status()).toBe(409);
    await invitation.goto(bruno);
    await invitation.getByLabel('No podré asistir').check();
    await invitation
      .getByRole('button', { name: 'Enviar mi respuesta', exact: true })
      .click();
    await expect(invitation).toHaveURL(/\/thanks\?confirmed=1/);
    await page.goto(roster);
    await expect(stats).toHaveText(['3', '1', '1', '1']);
    const anaCard = page.getByRole('article', {
      name: 'Invitación de Ana',
      exact: true,
    });
    await expect(
      anaCard.getByRole('button', { name: 'Eliminar invitado' }),
    ).toHaveCount(0);
    page.on('dialog', (dialog) => dialog.accept());
    const carlaCard = page.getByRole('article', {
      name: 'Invitación de Carla',
      exact: true,
    });
    await carlaCard.getByRole('button', { name: 'Desactivar enlace' }).click();
    await expect(
      carlaCard.getByText('El enlace está desactivado.', { exact: true }),
    ).toBeVisible();
    await expect(stats).toHaveText(['3', '1', '1', '1']);
    await invitation.goto(carla);
    await expect(invitation.locator('p[role="alert"]')).toContainText(
      'no está disponible',
    );
    await expect(invitation.locator('.rsvp-form')).toHaveCount(0);
    await carlaCard.getByRole('button', { name: 'Renovar enlace' }).click();
    const renewed = carlaCard.getByLabel('Enlace individual de Carla');
    await expect(renewed).toBeVisible();
    const newCarla = await renewed.inputValue();
    expect(newCarla).not.toBe(carla);
    expect((await resolve(rawToken(carla))).status()).toBe(404);
    await invitation.goto(newCarla);
    await invitation.getByLabel('No podré asistir').check();
    await invitation
      .getByRole('button', { name: 'Enviar mi respuesta', exact: true })
      .click();
    await expect(invitation).toHaveURL(/\/thanks\?confirmed=1/);
    await page.reload();
    await expect(stats).toHaveText(['3', '0', '1', '2']);
    const dora = await add(page, 'Dora');
    await expect(stats).toHaveText(['4', '1', '1', '2']);
    await page
      .getByRole('article', { name: 'Invitación de Dora', exact: true })
      .getByRole('button', { name: 'Eliminar invitado' })
      .click();
    await expect(stats).toHaveText(['3', '0', '1', '2']);
    expect((await resolve(rawToken(dora))).status()).toBe(404);
    const csv = await page.request.get(`/api/events/${event.id}/export`);
    const exported = await csv.text();
    expect(exported).toContain('Invitación individual');
    expect(exported).toContain('Enlace abierto');
    expect(exported).not.toContain(rawToken(ana));
    for (const width of [320, 714, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.goto(`${roster}?status=pending`);
    await expect(page.locator('.invitee-card')).toHaveCount(0);
    expect(
      (
        await pool.query(
          'select guest_name,party_size from rsvps where event_id=$1 and guest_id is not null and attendance',
          [event.id],
        )
      ).rows,
    ).toEqual([{ guest_name: 'Ana', party_size: 2 }]);
  } finally {
    await visitor.close();
  }
});

test('un segundo propietario no puede listar ni añadir invitados a otro evento', async ({
  page,
  browser,
}) => {
  const event = await createEvent(page);
  await page.goto(`/dashboard/events/${event.id}/invitees`);
  await add(page, 'Privado');
  const stranger = await browser.newContext({
    baseURL: 'http://localhost:3102',
  });
  try {
    const other = await stranger.newPage();
    const own = await createEvent(other);
    expect(
      (await other.goto(`/dashboard/events/${event.id}/invitees`))?.status(),
    ).toBe(404);
    await other.goto(`/dashboard/events/${own.id}/invitees`);
    const form = other.locator('.add-invitee');
    await form.getByLabel('Nombre del invitado').fill('Intruso');
    await form.locator('input[name="eventId"]').evaluate((input, id) => {
      (input as HTMLInputElement).value = id;
    }, event.id);
    await form
      .getByRole('button', { name: 'Añadir invitado', exact: true })
      .click();
    await expect(form.locator('p[role="alert"]')).toContainText(
      'no disponible',
    );
    expect(
      (
        await pool.query('select name from event_guests where event_id=$1', [
          event.id,
        ])
      ).rows,
    ).toEqual([{ name: 'Privado' }]);
  } finally {
    await stranger.close();
  }
});

test('dos enlaces compiten por el último cupo sin sobrepasarlo', async ({
  page,
  request,
}) => {
  const event = await createEvent(page, '1');
  await page.goto(`/dashboard/events/${event.id}/invitees`);
  const first = await add(page, 'Primero');
  const second = await add(page, 'Segundo');
  await page.goto(`/dashboard/events/${event.id}/edit`);
  await page
    .getByRole('button', { name: 'Publicar invitación ↗', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Volver a borrador', exact: true }),
  ).toBeVisible();
  const responses = await Promise.all(
    [first, second].map((url, i) =>
      request.post('/api/rsvp', {
        headers: {
          origin: 'http://localhost:3102',
          'x-forwarded-for': `198.51.100.${i + 1}`,
        },
        data: {
          slug: event.slug,
          inviteToken: rawToken(url),
          guestName: 'Intento simultáneo',
          guestEmail: '',
          attendance: true,
          partySize: 1,
          note: '',
          website: '',
          idempotencyKey: randomUUID(),
        },
      }),
    ),
  );
  expect(responses.map((response) => response.status()).sort()).toEqual([
    201, 409,
  ]);
  expect(
    (
      await pool.query(
        'select sum(party_size)::int total from rsvps where event_id=$1',
        [event.id],
      )
    ).rows[0].total,
  ).toBe(1);
  await page.goto(`/dashboard/events/${event.id}/invitees`);
  await expect(page.locator('.invitee-stats strong')).toHaveText([
    '2',
    '1',
    '1',
    '0',
  ]);
});

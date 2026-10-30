import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import pg from 'pg';
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_MIGRATION_URL,
});
const emails: string[] = [];
let counter = 0;
async function creator(page: Page) {
  const email = `management-${randomUUID()}@test.local`;
  emails.push(email);
  await page.goto('/register');
  await page.getByLabel('Correo electrónico').fill(email);
  await page
    .getByLabel('Contraseña', { exact: true })
    .fill('Gestionar respuestas locales 2026!');
  await page
    .getByRole('button', { name: 'Crear mi cuenta', exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/dashboard/events/new');
  await page.getByLabel('Título del evento').fill('Celebración con cambios');
  await page.getByLabel('Fecha y hora local').fill('2027-08-20T18:00');
  await page.getByLabel('Lugar', { exact: true }).fill('Jardín local');
  await page.getByLabel('Cupo total', { exact: false }).fill('3');
  await page
    .getByRole('button', { name: 'Crear mi invitación', exact: true })
    .click();
  await expect(page).toHaveURL(/\/events\/[a-f0-9-]+\/edit/);
  const id = /\/events\/([^/]+)\//.exec(page.url())![1];
  await page
    .getByRole('button', { name: 'Publicar invitación ↗', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Volver a borrador', exact: true }),
  ).toBeVisible();
  return (await pool.query('select id,slug from events where id=$1', [id]))
    .rows[0] as { id: string; slug: string };
}
async function separateAttempts(context: BrowserContext) {
  await context.route('**/api/**', (route) =>
    route.continue({
      headers: {
        ...route.request().headers(),
        'x-forwarded-for': `203.0.113.${++counter}`,
      },
    }),
  );
}
test.afterAll(async () => {
  await pool.query('delete from app_users where email=any($1::text[])', [
    emails,
  ]);
  await pool.end();
});

test('respuesta abierta: enlace privado, edición, versión antigua, cancelación y liberación de cupos', async ({
  page,
  browser,
  request,
}) => {
  const event = await creator(page);
  const visitor = await browser.newContext({
    baseURL: 'http://localhost:3102',
  });
  await separateAttempts(visitor);
  try {
    const guest = await visitor.newPage();
    const urls: string[] = [];
    guest.on('request', (req) => {
      if (req.url().includes('/api/')) urls.push(req.url());
    });
    await guest.goto(`/i/${event.slug}`);
    await guest
      .getByLabel('Tu nombre', { exact: true })
      .fill('María de prueba');
    await guest.getByLabel('Correo electrónico').fill('respuesta@test.local');
    await guest
      .getByRole('button', { name: 'Enviar mi respuesta', exact: true })
      .click();
    await expect(guest).toHaveURL(/\/thanks\?confirmed=1/);
    const link = guest.getByRole('link', {
      name: 'Gestionar mi respuesta',
      exact: true,
    });
    await expect(link).toBeVisible();
    const path = (await link.getAttribute('href'))!;
    const token = path.split('#respuesta=')[1];
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    const stored = (
      await pool.query('select management_hash from rsvps where event_id=$1', [
        event.id,
      ])
    ).rows[0].management_hash;
    expect(stored).toBe(createHash('sha256').update(token).digest('hex'));
    await link.click();
    await expect(guest.locator('.rsvp-edit-form')).toBeVisible();
    const old = await visitor.newPage();
    await old.goto(path);
    await expect(old.locator('.rsvp-edit-form')).toBeVisible();
    await guest
      .getByLabel('Tu nombre', { exact: true })
      .fill('María corregida');
    await guest
      .getByLabel('Personas que asistirán, incluyéndote')
      .selectOption('2');
    await guest
      .getByRole('button', {
        name: 'Guardar cambios de mi respuesta',
        exact: true,
      })
      .click();
    await expect(
      guest.getByText('Tu respuesta fue actualizada.', { exact: true }),
    ).toBeVisible();
    await expect(
      guest.getByText('Confirmaste para 2 personas.', { exact: true }),
    ).toBeVisible();
    await old
      .getByLabel('Mensaje para los anfitriones')
      .fill('Pestaña desactualizada');
    await old
      .getByRole('button', {
        name: 'Guardar cambios de mi respuesta',
        exact: true,
      })
      .click();
    await expect(old.locator('p[role="alert"]')).toContainText('otra pestaña');
    await old.close();
    for (const width of [320, 714, 1280]) {
      await guest.setViewportSize({ width, height: 900 });
      expect(
        await guest.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await guest
      .locator('.rsvp-management')
      .screenshot({ path: '.local/rsvp-management-preview.png' });
    await pool.query('update events set rsvp_open=false where id=$1', [
      event.id,
    ]);
    await guest
      .getByRole('button', { name: 'Recargar datos', exact: true })
      .click();
    await expect(guest.locator('.rsvp-edit-form')).toHaveCount(0);
    guest.once('dialog', (dialog) => dialog.accept());
    await guest
      .getByRole('button', { name: 'Cancelar mi asistencia', exact: true })
      .click();
    await expect(
      guest.getByText('Tu asistencia está cancelada.', { exact: true }),
    ).toBeVisible();
    expect(
      (
        await pool.query(
          'select coalesce(sum(party_size),0)::int total from rsvps where event_id=$1 and attendance',
          [event.id],
        )
      ).rows[0].total,
    ).toBe(0);
    await page.goto(`/dashboard/events/${event.id}/guests`);
    await expect(
      page.getByText('Canceló asistencia', { exact: true }),
    ).toBeVisible();
    expect(
      await (await page.request.get(`/api/events/${event.id}/export`)).text(),
    ).toContain('Cancelada');
    const publicHtml = await (
      await request.get(`/i/${event.slug}/manage`)
    ).text();
    for (const value of [token, 'María corregida', 'respuesta@test.local'])
      expect(publicHtml).not.toContain(value);
    expect(urls.every((url) => !url.includes(token))).toBe(true);
    await pool.query('update events set rsvp_open=true where id=$1', [
      event.id,
    ]);
    await guest
      .getByRole('button', { name: 'Recargar datos', exact: true })
      .click();
    await guest
      .getByRole('combobox', { name: 'Asistencia', exact: true })
      .selectOption('yes');
    await guest
      .getByLabel('Personas que asistirán, incluyéndote')
      .selectOption('2');
    await guest
      .getByRole('button', {
        name: 'Guardar cambios de mi respuesta',
        exact: true,
      })
      .click();
    await expect(
      guest.getByText('Confirmaste para 2 personas.', { exact: true }),
    ).toBeVisible();
    expect(
      (
        await pool.query('select cancelled_at from rsvps where event_id=$1', [
          event.id,
        ])
      ).rows[0].cancelled_at,
    ).toBeNull();
    await guest.goto(`/i/${event.slug}/manage#respuesta=inválido`);
    await expect(guest.locator('.rsvp-edit-form')).toHaveCount(0);
    await expect(
      guest.getByText('Abre el enlace privado de gestión', { exact: false }),
    ).toBeVisible();
  } finally {
    await visitor.close();
  }
});

test('invitación individual: mantiene cupo y pendientes, y renovar invalida la gestión anterior', async ({
  page,
  browser,
}) => {
  const event = await creator(page);
  await page.goto(`/dashboard/events/${event.id}/invitees`);
  const add = page.locator('.add-invitee');
  await add.getByLabel('Nombre del invitado').fill('Ana nominativa');
  await add
    .getByLabel('Correo de contacto')
    .fill('contacto-privado@test.local');
  await add
    .getByLabel('Cupo de esta invitación', { exact: false })
    .selectOption('2');
  await add
    .getByRole('button', { name: 'Añadir invitado', exact: true })
    .click();
  const url = await page
    .getByLabel('Enlace individual de Ana nominativa')
    .inputValue();
  const visitor = await browser.newContext({
    baseURL: 'http://localhost:3102',
  });
  await separateAttempts(visitor);
  try {
    const guest = await visitor.newPage();
    await guest.goto(url);
    await expect(guest.getByLabel('Tu nombre', { exact: true })).toHaveValue(
      'Ana nominativa',
    );
    await guest
      .getByLabel('Personas que asistirán, incluyéndote')
      .selectOption('2');
    await guest
      .getByRole('button', { name: 'Enviar mi respuesta', exact: true })
      .click();
    await expect(guest).toHaveURL(/\/thanks\?confirmed=1/);
    await guest.goto(url);
    await guest
      .getByRole('link', { name: 'Gestionar mi respuesta', exact: true })
      .click();
    await expect(
      guest.getByLabel('Tu nombre', { exact: true }),
    ).toHaveAttribute('readonly', '');
    await expect(guest.locator('select[name="partySize"] option')).toHaveCount(
      2,
    );
    await expect(guest.getByLabel('Correo electrónico')).toHaveValue('');
    const oldManagement = guest.url();
    guest.once('dialog', (dialog) => dialog.accept());
    await guest
      .getByRole('button', { name: 'Cancelar mi asistencia', exact: true })
      .click();
    await expect(
      guest.getByText('Tu asistencia está cancelada.', { exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(page.locator('.invitee-stats strong')).toHaveText([
      '1',
      '0',
      '0',
      '1',
    ]);
    page.once('dialog', (dialog) => dialog.accept());
    await page
      .getByRole('button', { name: 'Renovar enlace', exact: true })
      .click();
    await expect(
      page.getByLabel('Enlace individual de Ana nominativa'),
    ).not.toHaveValue(url);
    await guest.goto(oldManagement);
    await guest.reload();
    await expect(guest.locator('p[role="alert"]')).toContainText(
      'no está disponible',
    );
    const renewed = await page
      .getByLabel('Enlace individual de Ana nominativa')
      .inputValue();
    await guest.goto(renewed);
    await guest
      .getByRole('link', { name: 'Gestionar mi respuesta', exact: true })
      .click();
    await guest
      .getByRole('combobox', { name: 'Asistencia', exact: true })
      .selectOption('yes');
    await guest
      .getByRole('button', {
        name: 'Guardar cambios de mi respuesta',
        exact: true,
      })
      .click();
    await expect(
      guest.getByText('Confirmaste para 1 persona.', { exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(page.locator('.invitee-stats strong')).toHaveText([
      '1',
      '0',
      '1',
      '0',
    ]);
  } finally {
    await visitor.close();
  }
});

test('cambios concurrentes comparten capacidad y la gestión funciona sin sessionStorage', async ({
  page,
  request,
  browser,
}) => {
  const event = await creator(page);
  const tokens = [
    randomBytes(32).toString('hex'),
    randomBytes(32).toString('hex'),
  ];
  const headers = () => ({
    origin: 'http://localhost:3102',
    'x-forwarded-for': `198.51.100.${100 + ++counter}`,
  });
  for (let i = 0; i < 2; i++) {
    const response = await request.post('/api/rsvp', {
      headers: headers(),
      data: {
        slug: event.slug,
        guestName: `Invitado ${i}`,
        guestEmail: '',
        attendance: false,
        partySize: 1,
        note: '',
        website: '',
        idempotencyKey: randomUUID(),
        managementToken: tokens[i],
      },
    });
    expect(response.status()).toBe(201);
  }
  const writes = await Promise.all(
    tokens.map((token) =>
      request.post('/api/rsvp/manage', {
        headers: headers(),
        data: {
          slug: event.slug,
          kind: 'open',
          token,
          revision: 1,
          intent: 'update',
          guestName: 'Invitado actualizado',
          guestEmail: '',
          attendance: true,
          partySize: 3,
          note: '',
        },
      }),
    ),
  );
  expect(writes.map((response) => response.status()).sort()).toEqual([
    200, 409,
  ]);
  expect(
    (
      await pool.query(
        'select sum(party_size)::int total from rsvps where event_id=$1 and attendance',
        [event.id],
      )
    ).rows[0].total,
  ).toBe(3);
  expect(
    (
      await request.post('/api/rsvp/manage/resolve', {
        data: { slug: event.slug, kind: 'open', token: tokens[0] },
      })
    ).status(),
  ).toBe(403);
  const context = await browser.newContext({
    baseURL: 'http://localhost:3102',
  });
  await separateAttempts(context);
  await context.addInitScript(() => {
    Object.defineProperty(window, 'sessionStorage', {
      get() {
        throw new Error('Storage disabled');
      },
    });
  });
  try {
    const guest = await context.newPage();
    await guest.goto(`/i/${event.slug}`);
    await guest
      .getByLabel('Tu nombre', { exact: true })
      .fill('Sin almacenamiento');
    await guest.getByLabel('No podré asistir').check();
    await guest
      .getByRole('button', { name: 'Enviar mi respuesta', exact: true })
      .click();
    await expect(guest).toHaveURL(
      /\/thanks\?confirmed=1#respuesta=[a-f0-9]{64}/,
    );
    await guest
      .getByRole('link', { name: 'Gestionar mi respuesta', exact: true })
      .click();
    await expect(guest.getByLabel('Tu nombre', { exact: true })).toHaveValue(
      'Sin almacenamiento',
    );
  } finally {
    await context.close();
  }
});

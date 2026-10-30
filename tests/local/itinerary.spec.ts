import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_MIGRATION_URL,
});
const emails: string[] = [];
async function creator(page: Page) {
  const email = `itinerary-${randomUUID()}@test.local`;
  emails.push(email);
  await page.goto('/register');
  await page.getByLabel('Correo electrónico').fill(email);
  await page
    .getByLabel('Contraseña', { exact: true })
    .fill('Itinerario para pruebas locales 2026!');
  await page
    .getByRole('button', { name: 'Crear mi cuenta', exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/dashboard/events/new');
  await page.getByLabel('Título del evento').fill('Nuestra celebración');
  await page.getByLabel('Fecha y hora local').fill('2027-08-20T18:00');
  await page.getByLabel('Lugar', { exact: true }).fill('Jardín principal');
  await page
    .getByRole('button', { name: 'Crear mi invitación', exact: true })
    .click();
  await expect(page).toHaveURL(/\/events\/[a-f0-9-]+\/edit/);
  const id = /\/events\/([^/]+)\//.exec(page.url())![1];
  return (await pool.query('select id,slug from events where id=$1', [id]))
    .rows[0] as { id: string; slug: string };
}
async function prepare(page: Page, title: string, date: string) {
  const form = page.locator('.activity-add');
  await form.getByLabel('Título de la actividad').fill(title);
  await form.getByLabel('Fecha y hora de la actividad').fill(date);
  await form.getByLabel('Lugar de la actividad').fill('Salón de los recuerdos');
  await form
    .getByLabel('Descripción de la actividad')
    .fill('Un momento para compartir.');
}
test.afterAll(async () => {
  await pool.query('delete from app_users where email=any($1::text[])', [
    emails,
  ]);
  await pool.end();
});
test('itinerario editable, orden cronológico, varios días, privacidad y presentación pública', async ({
  page,
  browser,
  request,
}) => {
  const event = await creator(page);
  const edit = `/dashboard/events/${event.id}/edit`;
  await page.goto(`/dashboard/events/${event.id}/preview`);
  await expect(page.locator('.event-itinerary')).toHaveCount(0);
  await page.goto(edit);
  await page.getByRole('link', { name: 'Itinerario', exact: true }).click();
  await prepare(page, 'Cena', '2027-08-20T20:00');
  await page
    .getByRole('button', { name: 'Añadir actividad', exact: true })
    .click();
  await expect(page.locator('.activity-edit-card')).toHaveCount(1);
  await prepare(page, 'Ceremonia', '2027-08-20T18:00');
  await page
    .getByRole('button', { name: 'Añadir actividad', exact: true })
    .click();
  await expect(page.locator('.activity-edit-card')).toHaveCount(2);
  await expect(
    page.locator('.activity-edit-card input[name="title"]').first(),
  ).toHaveValue('Ceremonia');
  await expect(
    page.locator('.activity-edit-card input[name="title"]').last(),
  ).toHaveValue('Cena');
  const dinner = page.getByRole('article', {
    name: 'Actividad: Cena',
    exact: true,
  });
  await dinner.getByLabel('Título de la actividad').fill('Baile de despedida');
  await dinner
    .getByLabel('Fecha y hora de la actividad')
    .fill('2027-08-21T01:00');
  await dinner
    .getByLabel('Descripción de la actividad')
    .fill('Primera línea.\nSegunda línea. <script>alert(1)</script>');
  await dinner
    .getByRole('button', { name: 'Guardar actividad', exact: true })
    .click();
  await expect(
    page.getByRole('article', {
      name: 'Actividad: Baile de despedida',
      exact: true,
    }),
  ).toBeVisible();
  expect(
    (
      await pool.query(
        'select starts_at from event_activities where event_id=$1 and title=$2',
        [event.id, 'Baile de despedida'],
      )
    ).rows[0].starts_at.toISOString(),
  ).toBe('2027-08-21T06:00:00.000Z');
  expect((await request.get(`/i/${event.slug}`)).status()).toBe(404);
  await page.goto(`/dashboard/events/${event.id}/preview`);
  await expect(page.locator('.itinerary-timeline h3')).toHaveText([
    'Ceremonia',
    'Baile de despedida',
  ]);
  await expect(page.locator('.itinerary-timeline time strong')).toHaveText([
    '18:00 h',
    '01:00 h',
  ]);
  await expect(
    page.locator('.itinerary-timeline time span').last(),
  ).toContainText('21 de agosto');
  await page.goto(edit);
  await page
    .getByRole('button', { name: 'Publicar invitación ↗', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Volver a borrador', exact: true }),
  ).toBeVisible();
  const visitor = await browser.newContext({
    baseURL: 'http://localhost:3102',
    javaScriptEnabled: false,
  });
  try {
    const invitation = await visitor.newPage();
    await invitation.goto(`/i/${event.slug}`);
    await expect(invitation.locator('.itinerary-timeline h3')).toHaveText([
      'Ceremonia',
      'Baile de despedida',
    ]);
    await expect(
      invitation.locator('.itinerary-description').last(),
    ).toContainText('<script>alert(1)</script>');
    for (const width of [320, 714, 1280]) {
      await invitation.setViewportSize({ width, height: 900 });
      expect(
        await invitation.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await invitation
      .locator('.event-itinerary')
      .screenshot({ path: '.local/itinerary-preview.png' });
    const publicHtml = await (await request.get(`/i/${event.slug}`)).text();
    expect(publicHtml).not.toContain(emails[0]);
    await page
      .getByRole('button', { name: 'Volver a borrador', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Publicar invitación ↗', exact: true }),
    ).toBeVisible();
    expect((await request.get(`/i/${event.slug}`)).status()).toBe(404);
  } finally {
    await visitor.close();
  }
  page.on('dialog', (dialog) => dialog.accept());
  await page
    .locator('.activity-edit-card')
    .first()
    .getByRole('button', { name: 'Eliminar actividad', exact: true })
    .click();
  await expect(page.locator('.activity-edit-card')).toHaveCount(1);
  await page
    .locator('.activity-edit-card')
    .first()
    .getByRole('button', { name: 'Eliminar actividad', exact: true })
    .click();
  await expect(page.locator('.activity-edit-card')).toHaveCount(0);
  await page.goto(`/dashboard/events/${event.id}/preview`);
  await expect(page.locator('.event-itinerary')).toHaveCount(0);
});

test('aislamiento, límite concurrente y borrado en cascada del itinerario', async ({
  page,
  browser,
}) => {
  const event = await creator(page);
  const edit = `/dashboard/events/${event.id}/edit`;
  for (let i = 0; i < 19; i++)
    await pool.query(
      "insert into event_activities(event_id,title,starts_at) values($1,$2,'2027-08-20T23:00Z')",
      [event.id, `Actividad ${i + 1}`],
    );
  await page.reload();
  const parallel = await page.context().newPage();
  try {
    await parallel.goto(edit);
    await prepare(page, 'Última actividad A', '2027-08-20T22:00');
    await prepare(parallel, 'Última actividad B', '2027-08-20T22:00');
    await Promise.all(
      [page, parallel].map((p) =>
        p
          .getByRole('button', { name: 'Añadir actividad', exact: true })
          .click(),
      ),
    );
    await expect
      .poll(
        async () =>
          Number(
            await page.locator('.activity-add p[role="alert"]').isVisible(),
          ) +
          Number(
            await parallel.locator('.activity-add p[role="alert"]').isVisible(),
          ),
      )
      .toBe(1);
    expect(
      (
        await pool.query(
          'select count(*)::int count from event_activities where event_id=$1',
          [event.id],
        )
      ).rows[0].count,
    ).toBe(20);
    await page.reload();
    await expect(page.locator('.activity-edit-card')).toHaveCount(20);
    await expect(
      page.getByRole('button', { name: 'Añadir actividad', exact: true }),
    ).toHaveCount(0);
  } finally {
    await parallel.close();
  }
  const stranger = await browser.newContext({
    baseURL: 'http://localhost:3102',
  });
  try {
    const other = await stranger.newPage();
    const own = await creator(other);
    expect((await other.goto(edit))?.status()).toBe(404);
    await other.goto(`/dashboard/events/${own.id}/edit`);
    await prepare(other, 'Intrusión', '2027-08-20T20:00');
    await other
      .locator('.activity-add input[name="eventId"]')
      .evaluate((input, id) => {
        (input as HTMLInputElement).value = id;
      }, event.id);
    await other
      .getByRole('button', { name: 'Añadir actividad', exact: true })
      .click();
    await expect(other.locator('.activity-add p[role="alert"]')).toContainText(
      'no disponible',
    );
    expect(
      (
        await pool.query(
          'select id from event_activities where event_id=$1 and title=$2',
          [event.id, 'Intrusión'],
        )
      ).rows,
    ).toHaveLength(0);
  } finally {
    await stranger.close();
  }
  page.on('dialog', (dialog) => dialog.accept());
  await page
    .locator('.activity-edit-card')
    .first()
    .getByRole('button', { name: 'Eliminar actividad', exact: true })
    .click();
  await expect(page.locator('.activity-edit-card')).toHaveCount(19);
  await prepare(page, 'Espacio recuperado', '2027-08-20T23:00');
  await page
    .getByRole('button', { name: 'Añadir actividad', exact: true })
    .click();
  await expect(page.locator('.activity-edit-card')).toHaveCount(20);
  await page
    .getByRole('button', { name: 'Eliminar evento', exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(
    (
      await pool.query('select id from event_activities where event_id=$1', [
        event.id,
      ])
    ).rows,
  ).toHaveLength(0);
});

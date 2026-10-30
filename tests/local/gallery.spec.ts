import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { galleryPng } from '../fixtures/gallery-png';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_MIGRATION_URL,
});
const emails: string[] = [];
async function creator(page: Page) {
  const email = `gallery-${randomUUID()}@test.local`;
  emails.push(email);
  await page.goto('/register');
  await page.getByLabel('Correo electrónico').fill(email);
  await page
    .getByLabel('Contraseña', { exact: true })
    .fill('Galería local para pruebas 2026!');
  await page
    .getByRole('button', { name: 'Crear mi cuenta', exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/dashboard/events/new');
  await page.getByLabel('Título del evento').fill('Una historia para celebrar');
  await page.getByLabel('Fecha y hora local').fill('2027-08-20T18:00');
  await page
    .getByLabel('Lugar', { exact: true })
    .fill('Jardín de los recuerdos');
  await page
    .getByRole('button', { name: 'Crear mi invitación', exact: true })
    .click();
  await expect(page).toHaveURL(/\/events\/[a-f0-9-]+\/edit/);
  return { email, id: /\/events\/([^/]+)\//.exec(page.url())![1] };
}
async function preparePhoto(
  page: Page,
  alt: string,
  caption: string,
  buffer = galleryPng(),
) {
  const form = page.locator('.gallery-upload');
  await form
    .getByLabel('Foto para la galería')
    .setInputFiles({ name: 'recuerdo.jpg', mimeType: 'image/gif', buffer });
  await form.getByLabel('Descripción de la nueva foto').fill(alt);
  await form.getByLabel('Pie de la nueva foto', { exact: false }).fill(caption);
}
async function upload(
  page: Page,
  alt: string,
  caption: string,
  count: number,
  buffer = galleryPng(),
) {
  await preparePhoto(page, alt, caption, buffer);
  await page
    .getByRole('button', { name: 'Añadir foto a la galería', exact: true })
    .click();
  await expect(page.locator('.gallery-edit-card')).toHaveCount(count);
}
test.afterAll(async () => {
  await pool.query('delete from app_users where email=any($1::text[])', [
    emails,
  ]);
  await pool.end();
});
test('galería privada, edición, orden, publicación, ampliación y límite concurrente', async ({
  page,
  browser,
  request,
}, testInfo) => {
  const owner = await creator(page);
  const original = galleryPng();
  const form = page.locator('.gallery-upload');
  await preparePhoto(
    page,
    'Un recuerdo familiar',
    'Nuestra historia',
    Buffer.from('<svg onload="alert(1)"></svg>'),
  );
  await form
    .getByRole('button', { name: 'Añadir foto a la galería', exact: true })
    .click();
  await expect(form.locator('[role="alert"]')).toContainText(
    'no es una imagen',
  );
  await expect(page.locator('.gallery-edit-card')).toHaveCount(0);
  await preparePhoto(
    page,
    'Un recuerdo demasiado grande',
    '',
    Buffer.alloc(3 * 1024 * 1024 + 1),
  );
  await form
    .getByRole('button', { name: 'Añadir foto a la galería', exact: true })
    .click();
  await expect(form.locator('[role="alert"]')).toContainText('hasta 3 MB');
  await upload(
    page,
    'Juntos en el jardín',
    'Nuestro primer viaje',
    1,
    original,
  );
  await upload(
    page,
    'Con toda la familia',
    'Un gran recuerdo',
    2,
    galleryPng(1),
  );
  const rows = (
    await pool.query(
      'select id from event_photos where event_id=$1 order by position',
      [owner.id],
    )
  ).rows;
  const first = rows[0].id,
    second = rows[1].id;
  expect((await request.get(`/api/photos/${first}`)).status()).toBe(404);
  const privatePhoto = await page.request.get(`/api/photos/${first}`);
  expect(privatePhoto.status()).toBe(200);
  expect(privatePhoto.headers()['content-type']).toBe('image/png');
  expect(await privatePhoto.body()).toEqual(original);
  await page.goto(`/dashboard/events/${owner.id}/preview`);
  await expect(page.locator('.photo-gallery-grid figure')).toHaveCount(2);
  const thumbnail = page.getByRole('button', { name: /Ampliar foto 1:/ });
  await thumbnail.click();
  const dialog = page.getByRole('dialog', { name: 'Fotos de la celebración' });
  await expect(dialog).toBeVisible();
  await expect
    .poll(() =>
      dialog
        .locator('img')
        .evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBe(320);
  await page.keyboard.press('ArrowRight');
  await expect(dialog.getByText('Foto 2 de 2', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(thumbnail).toBeFocused();
  await page.goto(`/dashboard/events/${owner.id}/edit`);
  await page
    .locator('.gallery-edit-card')
    .first()
    .getByRole('button', { name: 'Mover foto después', exact: true })
    .click();
  await expect(
    page
      .locator('.gallery-edit-card')
      .first()
      .getByLabel('Descripción de la foto', { exact: true }),
  ).toHaveValue('Con toda la familia');
  const card = page.locator('.gallery-edit-card').first();
  await card
    .getByLabel('Pie de foto', { exact: false })
    .fill('Familia y amigos');
  await card
    .getByRole('button', { name: 'Guardar detalles de la foto', exact: true })
    .click();
  await expect(
    card.getByText('Detalles de la foto guardados.', { exact: true }),
  ).toBeVisible();
  const stranger = await browser.newContext({
    baseURL: 'http://localhost:3102',
  });
  try {
    const other = await stranger.newPage();
    await creator(other);
    expect((await stranger.request.get(`/api/photos/${first}`)).status()).toBe(
      404,
    );
    await preparePhoto(other, 'Intento sobre otra galería', '');
    await other
      .locator('.gallery-upload input[name="eventId"]')
      .evaluate((el: HTMLInputElement, id) => {
        el.value = id;
      }, owner.id);
    await other
      .getByRole('button', { name: 'Añadir foto a la galería', exact: true })
      .click();
    await expect(other.locator('.gallery-upload [role="alert"]')).toHaveText(
      'Evento no disponible.',
    );
    expect(
      (
        await pool.query('select id from event_photos where event_id=$1', [
          owner.id,
        ])
      ).rowCount,
    ).toBe(2);
  } finally {
    await stranger.close();
  }
  await page
    .getByRole('button', { name: 'Publicar invitación ↗', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Volver a borrador', exact: true }),
  ).toBeVisible();
  const event = (
    await pool.query('select slug from events where id=$1', [owner.id])
  ).rows[0];
  const published = await request.get(`/i/${event.slug}`);
  expect(await published.text()).not.toContain(owner.email);
  expect((await request.get(`/api/photos/${first}`)).status()).toBe(200);
  const visitor = await browser.newContext({
    baseURL: 'http://localhost:3102',
  });
  try {
    const invitation = await visitor.newPage();
    await invitation.emulateMedia({ reducedMotion: 'reduce' });
    await invitation.goto(`/i/${event.slug}`);
    await expect(
      invitation.locator('.photo-gallery-grid figure').first(),
    ).toHaveAttribute('data-photo-id', second);
    await expect(
      invitation
        .locator('.photo-gallery-grid')
        .getByText('Familia y amigos', { exact: true }),
    ).toBeVisible();
    for (const width of [320, 714, 1280]) {
      await invitation.setViewportSize({ width, height: 800 });
      await invitation.locator('.invitation-gallery').scrollIntoViewIfNeeded();
      expect(
        await invitation.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth + 1,
        ),
      ).toBe(true);
      await invitation.getByRole('button', { name: /Ampliar foto 1:/ }).click();
      const viewer = invitation.getByRole('dialog', {
        name: 'Fotos de la celebración',
      });
      await expect(viewer).toBeVisible();
      expect(
        await viewer.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      ).toBe(true);
      await viewer
        .getByRole('button', { name: 'Foto siguiente', exact: true })
        .click();
      await expect(
        viewer.getByText('Foto 2 de 2', { exact: true }),
      ).toBeVisible();
      await invitation.keyboard.press('Escape');
    }
    await invitation
      .getByRole('heading', { name: 'Recuerdos que nos unen.', exact: true })
      .click();
    await invitation.locator('.invitation-gallery').screenshot({
      path: testInfo.outputPath('gallery-desktop.png'),
      style: '.motion-controls { visibility: hidden !important; }',
    });
  } finally {
    await visitor.close();
  }
  const noJs = await browser.newContext({
    baseURL: 'http://localhost:3102',
    javaScriptEnabled: false,
  });
  try {
    const basic = await noJs.newPage();
    await basic.goto(`/i/${event.slug}`);
    await basic.locator('.invitation-gallery').scrollIntoViewIfNeeded();
    await expect(basic.locator('.photo-gallery-grid figure')).toHaveCount(2);
    await expect(
      basic.locator('.photo-gallery-grid img').first(),
    ).toBeVisible();
  } finally {
    await noJs.close();
  }
  // Both tabs see seven photos before attempting the eighth upload.
  for (let count = 3; count <= 7; count++)
    await upload(
      page,
      `Recuerdo número ${count}`,
      `Un momento ${count}`,
      count,
      galleryPng(count),
    );
  const parallel = await page.context().newPage();
  try {
    await parallel.goto(`/dashboard/events/${owner.id}/edit`);
    await preparePhoto(page, 'Última foto desde la primera pestaña', '');
    await preparePhoto(parallel, 'Última foto desde la segunda pestaña', '');
    await Promise.all(
      [page, parallel].map((p) =>
        p
          .getByRole('button', {
            name: 'Añadir foto a la galería',
            exact: true,
          })
          .click(),
      ),
    );
    await expect
      .poll(
        async () =>
          Number(
            await page
              .locator('.gallery-upload')
              .getByText('Puedes guardar hasta 8 fotos por evento.', {
                exact: true,
              })
              .isVisible(),
          ) +
          Number(
            await parallel
              .locator('.gallery-upload')
              .getByText('Puedes guardar hasta 8 fotos por evento.', {
                exact: true,
              })
              .isVisible(),
          ),
      )
      .toBe(1);
    await expect
      .poll(async () =>
        Number(
          (
            await pool.query(
              'select count(*)::int count from event_photos where event_id=$1',
              [owner.id],
            )
          ).rows[0].count,
        ),
      )
      .toBe(8);
    await page.reload();
    await expect(page.locator('.gallery-edit-card')).toHaveCount(8);
    await expect(
      page.getByRole('button', {
        name: 'Añadir foto a la galería',
        exact: true,
      }),
    ).toBeDisabled();
  } finally {
    await parallel.close();
  }
  page.once('dialog', (dialog) => dialog.accept());
  await page
    .locator('.gallery-edit-card')
    .first()
    .getByRole('button', { name: 'Eliminar foto', exact: true })
    .click();
  await expect(page.locator('.gallery-edit-card')).toHaveCount(7);
  expect((await request.get(`/api/photos/${second}`)).status()).toBe(404);
  await upload(
    page,
    'Un nuevo recuerdo después de eliminar',
    'Seguimos celebrando',
    8,
  );
  await page
    .getByRole('button', { name: 'Volver a borrador', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Publicar invitación ↗', exact: true }),
  ).toBeVisible();
  expect((await request.get(`/api/photos/${first}`)).status()).toBe(404);
  page.once('dialog', (dialog) => dialog.accept());
  await page
    .getByRole('button', { name: 'Eliminar evento', exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(
    (
      await pool.query('select id from event_photos where event_id=$1', [
        owner.id,
      ])
    ).rowCount,
  ).toBe(0);
});

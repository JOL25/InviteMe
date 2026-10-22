import { test, expect } from '@playwright/test';
test('la landing y la invitación caben en pantallas de 320 px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  for (const path of ['/', '/ejemplo']) {
    await page.goto(path);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
  }
});
test('landing, ejemplo y RSVP de demostración', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: /Hay momentos/ }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Ver un ejemplo' }).click();
  await expect(
    page.getByRole('heading', { name: 'Valentina & Mateo' }),
  ).toBeVisible();
  await expect(page.locator('.countdown span').first()).toHaveText(/\d+/);
  await page.getByRole('link', { name: /Confirmar asistencia/ }).click();
  await page.getByLabel('Tu nombre').fill('María Pérez');
  await page.getByRole('radio', { name: 'No podré asistir' }).check();
  await expect(
    page.getByLabel('Personas que asistirán, incluyéndote'),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: /vista previa/ }),
  ).toBeDisabled();
  await expect(
    page.getByText('Esta es una invitación de ejemplo.', { exact: false }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test('no hay desbordamiento horizontal en páginas públicas', async ({
  page,
}, testInfo) => {
  for (const path of ['/', '/ejemplo', '/login', '/register']) {
    await page.goto(path);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
    await expect(page.locator('main')).toBeVisible();
    if (path === '/' || path === '/ejemplo') {
      // A full-page still should show content that normally reveals on scroll.
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await expect(page.locator('[data-motion="pending"]')).toHaveCount(0);
      await page.screenshot({
        path: testInfo.outputPath(
          `${path === '/' ? 'landing' : 'invitation'}.png`,
        ),
        fullPage: true,
        animations: 'disabled',
      });
    }
  }
});
test('sin configuración no se permite entrar al panel ni registrar cuentas', async ({
  page,
}) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
  await expect(
    page.getByRole('button', { name: 'Entrar a mi cuenta' }),
  ).toBeDisabled();
  await page.getByRole('link', { name: 'Crea tu cuenta' }).click();
  await expect(
    page.getByRole('button', { name: 'Crear mi cuenta' }),
  ).toBeDisabled();
});
test('borradores y slugs inexistentes no tienen página pública', async ({
  request,
}) => {
  const response = await request.get('/i/no-existe-1234');
  expect(response.status()).toBe(404);
});
test('API valida origen, datos y tamaño antes de acceder a la base', async ({
  request,
}) => {
  const data = {
    slug: 'test-event',
    guestName: 'María',
    attendance: true,
    partySize: 0,
    idempotencyKey: '11111111-1111-4111-8111-111111111111',
  };
  expect((await request.post('/api/rsvp', { data })).status()).toBe(403);
  expect(
    (
      await request.post('/api/rsvp', {
        headers: { Origin: 'http://localhost:3100' },
        data,
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post('/api/rsvp', {
        headers: { Origin: 'http://localhost:3100' },
        data: { ...data, partySize: 1 },
      })
    ).status(),
  ).toBe(503);
  expect(
    (
      await request.post('/api/rsvp', {
        headers: { Origin: 'http://localhost:3100' },
        data: { ...data, note: 'a'.repeat(20000) },
      })
    ).status(),
  ).toBe(400);
});

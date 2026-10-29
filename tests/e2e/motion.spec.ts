import { test, expect } from '@playwright/test';

test('las secciones aparecen al desplazarse y permanecen visibles', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const feature = page.locator('.feature-grid article').first();
  await expect(feature).toHaveAttribute('data-motion', 'pending');
  await feature.scrollIntoViewIfNeeded();
  await expect(feature).toHaveCSS('opacity', '1');
  await expect(feature).toHaveAttribute('data-motion', 'visible');
  await page
    .getByRole('heading', { name: /Hay momentos/ })
    .scrollIntoViewIfNeeded();
  await feature.scrollIntoViewIfNeeded();
  await expect(feature).toHaveCSS('opacity', '1');
});

test('activar movimiento reducido muestra todo inmediatamente', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await expect(page.locator('[data-motion="pending"]').first()).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('[data-motion="pending"]')).toHaveCount(0);
  await expect(page.locator('.hero-line').first()).toHaveCSS(
    'animation-name',
    'none',
  );
  await expect(page.locator('.feature-grid article').first()).toHaveCSS(
    'opacity',
    '1',
  );
  await page.goto('/ejemplo#rsvp');
  await expect(page.locator('#rsvp')).toHaveCSS('opacity', '1');
  await expect(page.getByLabel('Tu nombre', { exact: true })).toBeInViewport();
  await expect(page.locator('.invitation-hero-content h1')).toHaveCSS(
    'animation-name',
    'none',
  );
});

test('sin JavaScript todo el contenido sigue disponible', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(`${baseURL}/`);
    await expect(
      page.getByRole('group', { name: 'Animaciones de la página' }),
    ).toHaveCount(0);
    const feature = page.locator('.feature-grid article').first();
    await feature.scrollIntoViewIfNeeded();
    await expect(feature).toHaveCSS('opacity', '1');
    await expect(page.locator('[data-motion="pending"]')).toHaveCount(0);
    await page.goto(`${baseURL}/ejemplo#rsvp`);
    await expect(page.locator('#rsvp')).toHaveCSS('opacity', '1');
    await expect(page.getByLabel('Tu nombre', { exact: true })).toBeVisible();
  } finally {
    await context.close();
  }
});

test('permite activar movimiento explícito con el sistema reducido y repetirlo', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const lines = page.locator('.hero-line');
  await expect(lines.first()).toHaveCSS('animation-name', 'none');
  await page
    .getByRole('button', { name: 'Activar animaciones', exact: true })
    .click();
  await expect(page.locator('html')).toHaveAttribute(
    'data-site-motion',
    'full',
  );
  await expect(lines.nth(0)).toHaveCSS('animation-name', 'enter-left');
  await expect(lines.nth(1)).toHaveCSS('animation-name', 'enter-right');
  await expect
    .poll(async () =>
      Number(
        await lines.first().evaluate((el) => getComputedStyle(el).opacity),
      ),
    )
    .toBeGreaterThan(0);
  const moving = await lines.first().evaluate((el) => ({
    opacity: Number(getComputedStyle(el).opacity),
    x: parseFloat(getComputedStyle(el).translate),
    running: el.getAnimations().some((a) => a.playState === 'running'),
  }));
  expect(moving.running).toBe(true);
  expect(moving.opacity).toBeLessThan(1);
  expect(moving.x).toBeLessThan(0);
  await expect(lines.last()).toHaveCSS('opacity', '1');
  await page
    .getByRole('button', { name: 'Repetir animación de entrada' })
    .click();
  await expect
    .poll(() =>
      lines.last().evaluate((el) => Number(getComputedStyle(el).opacity)),
    )
    .toBeLessThan(1);
  await expect(lines.last()).toHaveCSS('opacity', '1');
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Desactivar animaciones' }),
  ).toBeVisible();
  await expect(lines.first()).toHaveCSS('animation-name', 'enter-left');
  await page.goto('/ejemplo');
  await page
    .getByLabel('Tu nombre', { exact: true })
    .fill('Nombre que se conserva');
  await page
    .getByRole('button', { name: 'Repetir animación de entrada' })
    .click();
  await expect(page.getByLabel('Tu nombre', { exact: true })).toHaveValue(
    'Nombre que se conserva',
  );
});

test('al pulsar una FAQ muestra una onda y conserva la interacción nativa', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const detail = page.locator('.faq-list details').first();
  const summary = detail.locator('summary');
  await summary.click();
  await expect(detail).toHaveAttribute('open', '');
  await expect(summary.locator('.click-wave')).toHaveCount(1);
  await expect(summary.locator('.click-wave')).toHaveCSS(
    'animation-name',
    'click-wave',
  );
  await expect(summary.locator('.click-wave')).toHaveCount(0);
});

test('la elección de desactivar movimiento persiste aunque el sistema lo permita', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Desactivar animaciones' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-motion="pending"]')).toHaveCount(0);
  await expect(page.locator('.feature-grid article').first()).toHaveCSS(
    'opacity',
    '1',
  );
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Activar animaciones', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.hero-line').first()).toHaveCSS(
    'animation-name',
    'none',
  );
});

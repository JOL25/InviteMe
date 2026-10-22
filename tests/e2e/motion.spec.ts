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
  await expect(page.locator('.hero-copy h1')).toHaveCSS(
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

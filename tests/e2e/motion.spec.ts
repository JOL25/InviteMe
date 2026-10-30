import { test, expect, type Locator } from '@playwright/test';
async function observeMotion(locator: Locator) {
  await locator.evaluate((element) => {
    element.removeAttribute('data-observed-motion');
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      if (root.dataset.siteMotion !== 'full') return;
      const animation = element.getAnimations()[0];
      if (!animation?.effect) return;
      const running = animation.playState === 'running';
      const timing = animation.effect.getTiming();
      // Inspect a real CSS animation at a fixed point before resuming it.
      // Separate browser round trips can miss the entire animation on a busy PC.
      animation.pause();
      animation.currentTime = (timing.delay ?? 0) + Number(timing.duration) / 2;
      const style = getComputedStyle(element);
      element.setAttribute(
        'data-observed-motion',
        JSON.stringify({
          running,
          opacity: Number(style.opacity),
          x: parseFloat(style.translate),
        }),
      );
      animation.play();
      observer.disconnect();
    });
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['data-site-motion'],
    });
  });
}

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
  await observeMotion(lines.first());
  await page
    .getByRole('button', { name: 'Activar animaciones', exact: true })
    .click();
  await expect(page.locator('html')).toHaveAttribute(
    'data-site-motion',
    'full',
  );
  await expect(lines.nth(0)).toHaveCSS('animation-name', 'enter-left');
  await expect(lines.nth(1)).toHaveCSS('animation-name', 'enter-right');
  await expect(lines.first()).toHaveAttribute(
    'data-observed-motion',
    /running/,
  );
  const moving = JSON.parse(
    (await lines.first().getAttribute('data-observed-motion'))!,
  ) as { running: boolean; opacity: number; x: number };
  expect(moving.running).toBe(true);
  expect(moving.opacity).toBeLessThan(1);
  expect(moving.opacity).toBeGreaterThan(0);
  expect(moving.x).toBeLessThan(0);
  await expect(lines.last()).toHaveCSS('opacity', '1');
  await observeMotion(lines.last());
  await page
    .getByRole('button', { name: 'Repetir animación de entrada' })
    .click();
  await expect(lines.last()).toHaveAttribute('data-observed-motion', /running/);
  expect(
    JSON.parse((await lines.last().getAttribute('data-observed-motion'))!)
      .opacity,
  ).toBeLessThan(1);
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
  await summary.evaluate((element) => {
    const observer = new MutationObserver(() => {
      const wave = element.querySelector('.click-wave');
      if (!wave) return;
      element.setAttribute(
        'data-observed-wave',
        getComputedStyle(wave).animationName,
      );
      observer.disconnect();
    });
    observer.observe(element, { childList: true });
  });
  await summary.click();
  await expect(detail).toHaveAttribute('open', '');
  await expect(summary).toHaveAttribute('data-observed-wave', 'click-wave');
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

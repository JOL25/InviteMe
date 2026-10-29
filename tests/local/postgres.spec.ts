import { test, expect, type Page } from '@playwright/test';
import { randomUUID, createHash } from 'node:crypto';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_MIGRATION_URL,
});
const password = 'InviteMe prueba local 2026!';
async function register(page: Page, email: string) {
  await page.goto('/register');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page
    .getByRole('button', { name: 'Crear mi cuenta', exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
test.afterAll(async () => {
  await pool.end();
});

test('cuentas, eventos, portada privada, publicación, RSVP, CSV y aislamiento', async ({
  page,
  browser,
  request,
}) => {
  const email = `owner-${randomUUID()}@test.local`;
  await register(page, email);
  const session = (await page.context().cookies()).find(
    (c) => c.name === 'inviteme_session',
  )!;
  expect(session.httpOnly).toBe(true);
  expect(session.sameSite).toBe('Lax');
  const stored = (await pool.query('select token_hash from app_sessions'))
    .rows[0].token_hash;
  expect(stored).toBe(createHash('sha256').update(session.value).digest('hex'));
  await page
    .getByRole('link', { name: 'Crear invitación', exact: true })
    .click();
  await page
    .getByLabel('Título del evento')
    .fill('Celebración PostgreSQL local');
  await page.getByLabel('Fecha y hora local').fill('2027-06-18T18:00');
  await page.getByLabel('Lugar', { exact: true }).fill('Jardín local');
  await page.getByLabel('Cupo total', { exact: false }).fill('3');
  await page
    .getByRole('button', { name: 'Crear mi invitación', exact: true })
    .click();
  await expect(page).toHaveURL(/\/events\/[a-f0-9-]+\/edit/);
  const event = (await pool.query('select * from events')).rows[0];
  expect((await request.get(`/api/events/${event.id}/export`)).status()).toBe(
    401,
  );
  expect((await request.get(`/i/${event.slug}`)).status()).toBe(404);
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6WQAAAABJRU5ErkJggg==',
    'base64',
  );
  await page
    .getByLabel('Imagen de portada')
    .setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: png });
  await page
    .getByRole('button', { name: 'Subir portada', exact: true })
    .click();
  await expect(
    page.getByText('Portada actualizada.', { exact: true }),
  ).toBeVisible();
  expect((await request.get(`/api/covers/${event.id}`)).status()).toBe(404);
  expect((await page.request.get(`/api/covers/${event.id}`)).status()).toBe(
    200,
  );
  const stranger = await browser.newContext({
    baseURL: 'http://localhost:3102',
  });
  try {
    const other = await stranger.newPage();
    await register(other, `stranger-${randomUUID()}@test.local`);
    for (const path of ['edit', 'preview', 'guests', 'share']) {
      expect(
        (await other.goto(`/dashboard/events/${event.id}/${path}`))?.status(),
      ).toBe(404);
    }
    expect(
      (await stranger.request.get(`/api/events/${event.id}/export`)).status(),
    ).toBe(404);
    expect(
      (await stranger.request.get(`/api/covers/${event.id}`)).status(),
    ).toBe(404);
    // Server Actions must recheck ownership even with a forged hidden event ID.
    await other.goto('/dashboard/events/new');
    await other.getByLabel('Título del evento').fill('Evento ajeno');
    await other.getByLabel('Fecha y hora local').fill('2027-07-01T18:00');
    await other.getByLabel('Lugar', { exact: true }).fill('Otro lugar');
    await other.locator('.event-form').evaluate((form, id) => {
      const hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.name = 'id';
      hidden.value = id;
      form.append(hidden);
    }, event.id);
    await other
      .getByRole('button', { name: 'Crear mi invitación', exact: true })
      .click();
    await expect(other.locator('p[role="alert"]')).toHaveText(
      'Evento no disponible.',
    );
    expect(
      (await pool.query('select title from events where id=$1', [event.id]))
        .rows[0].title,
    ).toBe(event.title);
  } finally {
    await stranger.close();
  }
  await page
    .getByRole('button', { name: 'Publicar invitación ↗', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Volver a borrador', exact: true }),
  ).toBeVisible();
  expect((await request.get(`/api/covers/${event.id}`)).status()).toBe(200);
  const publicPage = await request.get(`/i/${event.slug}`);
  expect(publicPage.status()).toBe(200);
  expect(await publicPage.text()).not.toContain(email);
  await page.goto(`/dashboard/events/${event.id}/share`);
  await expect(page.getByLabel('Enlace de tu invitación')).toHaveValue(
    `http://localhost:3102/i/${event.slug}`,
  );
  await expect(
    page.getByRole('img', { name: `Código QR de ${event.title}` }),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Descargar QR', exact: true }).click();
  expect((await downloadPromise).suggestedFilename()).toBe(
    `${event.slug}-qr.png`,
  );
  const guest = await browser.newContext({ baseURL: 'http://localhost:3102' });
  let idempotencyKey: string;
  try {
    const invitation = await guest.newPage();
    await invitation.goto(`/i/${event.slug}`);
    await invitation
      .getByRole('link', { name: 'Confirmar asistencia', exact: false })
      .click();
    await invitation
      .getByLabel('Tu nombre', { exact: true })
      .fill('María local');
    await invitation
      .getByLabel('Personas que asistirán, incluyéndote')
      .selectOption('2');
    await invitation
      .getByRole('button', { name: 'Enviar mi respuesta', exact: true })
      .click();
    await expect(invitation).toHaveURL(
      `http://localhost:3102/i/${event.slug}/thanks?confirmed=1`,
    );
    await expect(
      invitation.getByText('¡Te esperamos! Confirmaste para 2 personas.', {
        exact: true,
      }),
    ).toBeVisible();
    idempotencyKey = (
      await pool.query('select idempotency_key from rsvps where event_id=$1', [
        event.id,
      ])
    ).rows[0].idempotency_key;
  } finally {
    await guest.close();
  }
  const data = {
    slug: event.slug,
    guestName: 'María local',
    attendance: true,
    partySize: 2,
    idempotencyKey,
  };
  const submit = (body: object) =>
    request.post('/api/rsvp', {
      headers: { Origin: 'http://localhost:3102' },
      data: body,
    });
  expect((await submit(data)).status()).toBe(200);
  const concurrent = await Promise.all(
    [1, 2].map(() =>
      submit({
        ...data,
        guestName: 'Último cupo',
        partySize: 1,
        idempotencyKey: randomUUID(),
      }),
    ),
  );
  expect(concurrent.map((r) => r.status()).sort()).toEqual([201, 409]);
  expect(
    Number(
      (
        await pool.query(
          'select sum(party_size) total from rsvps where attendance',
        )
      ).rows[0].total,
    ),
  ).toBe(3);
  await page.goto(`/dashboard/events/${event.id}/guests`);
  await expect(
    page.getByRole('cell', { name: 'María local', exact: false }),
  ).toBeVisible();
  const csv = await page.request.get(`/api/events/${event.id}/export`);
  expect(csv.status()).toBe(200);
  expect(await csv.text()).toContain('María local');
  await pool.query(
    `insert into rsvps(event_id,guest_name,attendance,party_size,idempotency_key,created_at)
    select $1,'Invitado CSV '||n,false,1,gen_random_uuid(),clock_timestamp()+n*interval '1 microsecond' from generate_series(1,1001) n`,
    [event.id],
  );
  const longCsv = await page.request.get(`/api/events/${event.id}/export`);
  const text = await longCsv.text();
  expect(text).toContain('Invitado CSV 1001');
  expect(text.split('\n').filter(Boolean)).toHaveLength(1004);
  await page.goto(`/dashboard/events/${event.id}/edit`);
  await page.getByLabel('Cupo total', { exact: false }).fill('2');
  await page
    .getByRole('button', { name: 'Guardar cambios', exact: true })
    .click();
  await expect(page.locator('p[role="alert"]')).toContainText(
    'cupo no puede ser menor',
  );
  await page
    .getByRole('button', { name: 'Volver a borrador', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Publicar invitación ↗', exact: true }),
  ).toBeVisible();
  expect((await request.get(`/i/${event.slug}`)).status()).toBe(404);
  expect((await request.get(`/api/covers/${event.id}`)).status()).toBe(404);
  page.once('dialog', (dialog) => dialog.accept());
  await page
    .getByRole('button', { name: 'Eliminar evento', exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect((await pool.query('select * from covers')).rowCount).toBe(0);
  expect((await pool.query('select * from rsvps')).rowCount).toBe(0);
  await page.getByRole('button', { name: 'Salir', exact: true }).click();
  await expect(page).toHaveURL('http://localhost:3102/');
  // The old session is revoked in PostgreSQL, not just removed from the browser.
  expect(
    (
      await pool.query('select * from app_sessions where token_hash=$1', [
        stored,
      ])
    ).rowCount,
  ).toBe(0);
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page
    .getByRole('button', { name: 'Entrar a mi cuenta', exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await pool.query(
    "update app_sessions set expires_at=now()-interval '1 second'",
  );
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
});

test('rechaza contraseñas incorrectas, cuentas duplicadas y demasiados intentos', async ({
  page,
}) => {
  const email = `auth-${randomUUID()}@test.local`;
  await register(page, email);
  await page.getByRole('button', { name: 'Salir', exact: true }).click();
  await page.goto('/register');
  await page.getByLabel('Correo electrónico').fill(email.toUpperCase());
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page
    .getByRole('button', { name: 'Crear mi cuenta', exact: true })
    .click();
  await expect(page.locator('p[role="alert"]')).toContainText(
    'Si ya tienes una',
  );
  expect(
    (await pool.query('select id from app_users where email=$1', [email]))
      .rowCount,
  ).toBe(1);
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(email);
  await page
    .getByLabel('Contraseña', { exact: true })
    .fill('Contraseña equivocada');
  await page
    .getByRole('button', { name: 'Entrar a mi cuenta', exact: true })
    .click();
  await expect(page.locator('p[role="alert"]')).toHaveText(
    'Correo o contraseña incorrectos.',
  );
  const key = createHash('sha256').update(email).digest('hex');
  await pool.query('update auth_limits set attempts=10 where key=$1', [key]);
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page
    .getByRole('button', { name: 'Entrar a mi cuenta', exact: true })
    .click();
  await expect(page.locator('p[role="alert"]')).toContainText(
    'Demasiados intentos',
  );
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
});

test('RLS real filtra consultas sin WHERE y limpia el contexto de conexiones', async () => {
  const users = [randomUUID(), randomUUID()];
  for (const [index, id] of users.entries()) {
    await pool.query(
      'insert into app_users(id,email,password_hash) values($1,$2,$3)',
      [id, `rls-${id}@test.local`, 'fixture'],
    );
    await pool.query(
      `insert into events(owner_id,slug,title,starts_at,venue_name,message)
      values($1,$2,$3,now(),'Jardín','Nos vemos')`,
      [id, `rls-${id}`, `Evento ${index}`],
    );
  }
  const runtime = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await runtime.connect();
  try {
    const flags = (
      await runtime.query(
        'select rolsuper,rolbypassrls from pg_roles where rolname=current_user',
      )
    ).rows[0];
    expect(flags).toEqual({ rolsuper: false, rolbypassrls: false });
    expect((await runtime.query('select * from events')).rows).toHaveLength(0);
    for (const id of users) {
      await runtime.query('begin');
      await runtime.query("select set_config('app.user_id',$1,true)", [id]);
      expect((await runtime.query('select owner_id from events')).rows).toEqual(
        [{ owner_id: id }],
      );
      await runtime.query('commit');
      expect((await runtime.query('select * from events')).rows).toHaveLength(
        0,
      );
    }
    await runtime.query('begin');
    await runtime.query("select set_config('app.user_id',$1,true)", [users[0]]);
    await expect(
      runtime.query(
        `insert into events(owner_id,slug,title,starts_at,venue_name,message)
      values($1,'forged-owner','Intrusión',now(),'Jardín','Mensaje')`,
        [users[1]],
      ),
    ).rejects.toThrow(/row-level security/);
    await runtime.query('rollback');
    expect((await runtime.query('select * from events')).rows).toHaveLength(0);
    await expect(runtime.query('select * from app_users')).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      runtime.query('alter table events disable row level security'),
    ).rejects.toThrow(/owner/);
  } finally {
    await runtime.end();
  }
});

import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { beforeAll, beforeEach, afterEach, afterAll, it, expect } from 'vitest';
import { grantRuntime } from '../../scripts/runtime-grants.mjs';
let db: PGlite;
const owner = '11111111-1111-4111-8111-111111111111',
  event = '22222222-2222-4222-8222-222222222222',
  guest = '33333333-3333-4333-8333-333333333333';
const openHash = 'a'.repeat(64),
  guestHash = 'b'.repeat(64);
let attempts = 0;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    'create table app_migrations(name text primary key,checksum text not null);create role app_runtime nosuperuser nobypassrls',
  );
  for (const file of readdirSync('database/migrations')
    .filter((f) => f.endsWith('.sql'))
    .sort())
    await db.exec(readFileSync(`database/migrations/${file}`, 'utf8'));
  await grantRuntime(db, 'app_runtime');
  await db.query(
    "insert into app_users(id,email,password_hash) values($1,'owner@test.local','hash')",
    [owner],
  );
  await db.query(
    "insert into events(id,owner_id,slug,title,starts_at,venue_name,message,capacity,published_at) values($1,$2,'managed-event','Celebración',now(),'Jardín','Nos vemos',5,now())",
    [event, owner],
  );
  await db.query(
    "insert into event_guests(id,event_id,name,email,max_party_size,token_nonce,token_hash) values($1,$2,'Ana','contacto-privado@test.local',3,gen_random_uuid(),$3)",
    [guest, event, guestHash],
  );
  await db.query(
    "insert into rsvps(event_id,guest_name,guest_email,attendance,party_size,note,idempotency_key,management_hash) values($1,'Abierto','reply@test.local',true,1,'Mensaje',gen_random_uuid(),$2)",
    [event, openHash],
  );
  await db.query(
    "insert into rsvps(event_id,guest_id,guest_name,attendance,party_size,idempotency_key) values($1,$2,'Ana',true,2,gen_random_uuid())",
    [event, guest],
  );
});
beforeEach(async () => {
  await db.exec('begin');
});
afterEach(async () => {
  await db.exec('rollback;reset role');
});
afterAll(async () => {
  await db?.close();
});
async function lookup(kind = 'open', hash = openHash, slug = 'managed-event') {
  await db.exec('set role app_runtime');
  try {
    return (
      await db.query<{ guest_name: string; revision: number }>(
        'select * from resolve_rsvp_management($1,$2,$3)',
        [slug, kind, hash],
      )
    ).rows;
  } finally {
    await db.exec('reset role');
  }
}
async function manage(change: Record<string, unknown> = {}) {
  const data = {
    slug: 'managed-event',
    kind: 'open',
    hash: openHash,
    revision: 1,
    intent: 'update',
    name: 'Abierto',
    email: 'reply@test.local',
    attendance: true,
    size: 1,
    note: 'Mensaje',
    client: (++attempts).toString(16).padStart(64, '0'),
    ...change,
  };
  await db.exec('set role app_runtime');
  try {
    return (
      await db.query<{ result: { status: number; revision: number } }>(
        'select manage_rsvp($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) result',
        Object.values(data),
      )
    ).rows[0].result;
  } finally {
    await db.exec('reset role');
  }
}
it('solo el enlace de la respuesta correcta revela sus datos y no expone el contacto de la lista', async () => {
  expect((await lookup())[0].guest_name).toBe('Abierto');
  expect((await lookup('guest', guestHash))[0].guest_name).toBe('Ana');
  expect(JSON.stringify(await lookup('guest', guestHash))).not.toContain(
    'contacto-privado',
  );
  for (const [kind, hash, slug] of [
    ['guest', openHash, 'managed-event'],
    ['open', guestHash, 'managed-event'],
    ['open', openHash, 'other-event'],
  ])
    expect(await lookup(kind, hash, slug)).toHaveLength(0);
});
it('edita excluyendo los cupos anteriores y rechaza ampliaciones sobre la capacidad', async () => {
  expect((await manage({ size: 3, name: 'Nombre corregido' })).status).toBe(
    200,
  );
  expect((await manage({ revision: 2, size: 4 })).status).toBe(409);
  expect(
    (
      await db.query(
        'select sum(party_size)::int total from rsvps where attendance',
      )
    ).rows,
  ).toEqual([{ total: 5 }]);
});
it('el invitado conserva su nombre y no puede superar el cupo individual', async () => {
  expect(
    (await manage({ kind: 'guest', hash: guestHash, size: 4 })).status,
  ).toBe(409);
  expect(
    (
      await manage({
        kind: 'guest',
        hash: guestHash,
        size: 3,
        name: 'Suplantado',
      })
    ).status,
  ).toBe(200);
  expect((await lookup('guest', guestHash))[0].guest_name).toBe('Ana');
});
it('una versión antigua nunca sobrescribe el cambio de otra pestaña', async () => {
  expect((await manage({ note: 'Primera pestaña' })).revision).toBe(2);
  expect((await manage({ note: 'Pestaña antigua' })).status).toBe(409);
  expect(
    (
      await db.query('select note from rsvps where management_hash=$1', [
        openHash,
      ])
    ).rows,
  ).toEqual([{ note: 'Primera pestaña' }]);
});
it('permite cancelar con RSVP cerrado, libera cupos y conserva la respuesta y los pendientes', async () => {
  await db.query('update events set rsvp_open=false');
  expect((await manage()).status).toBe(409);
  expect(
    (await manage({ kind: 'guest', hash: guestHash, intent: 'cancel' })).status,
  ).toBe(200);
  expect(
    (await manage({ kind: 'guest', hash: guestHash, intent: 'cancel' })).status,
  ).toBe(200);
  const row = (
    await db.query<{
      attendance: boolean;
      cancelled_at: unknown;
      revision: number;
    }>('select attendance,cancelled_at,revision from rsvps where guest_id=$1', [
      guest,
    ])
  ).rows[0];
  expect(row.attendance).toBe(false);
  expect(row.cancelled_at).not.toBeNull();
  expect(row.revision).toBe(2);
  expect(
    (
      await db.query(
        'select count(*)::int pending from event_guests g where not exists(select 1 from rsvps r where r.guest_id=g.id)',
      )
    ).rows,
  ).toEqual([{ pending: 0 }]);
  expect(
    (
      await db.query(
        'select sum(party_size)::int total from rsvps where attendance',
      )
    ).rows,
  ).toEqual([{ total: 1 }]);
});
it('puede reconfirmar tras cancelar si hay cupos y las confirmaciones están abiertas', async () => {
  await manage({ intent: 'cancel' });
  expect((await manage({ revision: 2, size: 2 })).status).toBe(200);
  expect(
    (
      await db.query(
        'select cancelled_at,attendance from rsvps where management_hash=$1',
        [openHash],
      )
    ).rows,
  ).toEqual([{ cancelled_at: null, attendance: true }]);
});
it('revocar, renovar o despublicar invalida también la gestión de la respuesta', async () => {
  await db.query('update event_guests set revoked_at=now()');
  expect(await lookup('guest', guestHash)).toHaveLength(0);
  expect((await manage({ kind: 'guest', hash: guestHash })).status).toBe(404);
  await db.query('update event_guests set revoked_at=null,token_hash=$1', [
    'c'.repeat(64),
  ]);
  expect((await manage({ kind: 'guest', hash: guestHash })).status).toBe(404);
  expect((await manage({ kind: 'guest', hash: 'c'.repeat(64) })).status).toBe(
    200,
  );
  await db.query('update events set published_at=null');
  expect(await lookup()).toHaveLength(0);
  expect((await manage()).status).toBe(404);
});
it('comparte el límite persistente de intentos y valida datos en SQL', async () => {
  expect((await manage({ hash: 'no-es-token' })).status).toBe(400);
  expect((await manage({ revision: 0 })).status).toBe(400);
  expect((await manage({ size: 11 })).status).toBe(400);
  for (let i = 0; i < 10; i++)
    await manage({ client: 'd'.repeat(64), hash: 'e'.repeat(64) });
  expect((await manage({ client: 'd'.repeat(64) })).status).toBe(429);
});
it('solo el alta abierta asigna el enlace: los reintentos no pueden apropiarse de respuestas previas', async () => {
  const key = crypto.randomUUID(),
    hash = 'f'.repeat(64);
  const args = [
    'managed-event',
    'Nuevo invitado',
    '',
    false,
    1,
    '',
    key,
    '9'.repeat(64),
    hash,
  ];
  const submit = async (values: unknown[]) =>
    (
      await db.query<{ result: { status: number } }>(
        'select submit_managed_rsvp($1,$2,$3,$4,$5,$6,$7,$8,$9) result',
        values,
      )
    ).rows[0].result.status;
  expect(await submit(args)).toBe(201);
  expect(await submit(args)).toBe(200);
  expect(await submit([...args.slice(0, 8), '8'.repeat(64)])).toBe(409);
  const legacyKey = crypto.randomUUID();
  await db.query('select submit_rsvp($1,$2,$3,$4,$5,$6,$7,$8)', [
    ...args.slice(0, 6),
    legacyKey,
    '7'.repeat(64),
  ]);
  expect(
    await submit([
      ...args.slice(0, 6),
      legacyKey,
      '6'.repeat(64),
      '5'.repeat(64),
    ]),
  ).toBe(409);
  expect(
    (
      await db.query(
        'select management_hash from rsvps where idempotency_key=$1',
        [legacyKey],
      )
    ).rows,
  ).toEqual([{ management_hash: null }]);
});
it('el runtime no puede editar respuestas directamente, ni con identidad de propietario', async () => {
  await db.exec('set role app_runtime');
  await db.query("select set_config('app.user_id',$1,true)", [owner]);
  await expect(db.query('update rsvps set attendance=false')).rejects.toThrow();
});

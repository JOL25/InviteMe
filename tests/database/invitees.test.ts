import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { beforeAll, afterAll, it, expect } from 'vitest';
import { grantRuntime } from '../../scripts/runtime-grants.mjs';
import { guestTokenHash } from '@/lib/invite-tokens';
let db: PGlite;
const owner = '11111111-1111-4111-8111-111111111111',
  other = '22222222-2222-4222-8222-222222222222';
const event = '33333333-3333-4333-8333-333333333333',
  second = '44444444-4444-4444-8444-444444444444';
const alice = '55555555-5555-4555-8555-555555555555',
  bob = '66666666-6666-4666-8666-666666666666',
  cara = '77777777-7777-4777-8777-777777777777';
const tokens = ['1'.repeat(64), '2'.repeat(64), '3'.repeat(64)];
let sequence = 0;
const key = crypto.randomUUID();
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
    "insert into app_users(id,email,password_hash) values($1,'owner@test.local','hash'),($2,'other@test.local','hash')",
    [owner, other],
  );
  for (const [id, user, slug] of [
    [event, owner, 'named-event'],
    [second, other, 'other-event'],
  ])
    await db.query(
      `insert into events(id,owner_id,slug,title,starts_at,venue_name,message,capacity,published_at)
    values($1,$2,$3,'Nuestra fiesta',now(),'Jardín','Nos vemos',4,now())`,
      [id, user, slug],
    );
  for (const [id, eventId, name, token, max] of [
    [alice, event, 'Ana Pérez', tokens[0], 2],
    [bob, event, 'Bruno Ruiz', tokens[1], 1],
    [cara, second, 'Carla Díaz', tokens[2], 1],
  ])
    await db.query(
      "insert into event_guests(id,event_id,name,email,max_party_size,token_nonce,token_hash) values($1,$2,$3,'privado@test.local',$4,gen_random_uuid(),$5)",
      [id, eventId, name, max, guestTokenHash(String(token))],
    );
});
afterAll(async () => {
  await db?.close();
});
async function submit(overrides: Record<string, unknown> = {}) {
  const args = {
    slug: 'named-event',
    hash: guestTokenHash(tokens[0]),
    email: '',
    attendance: true,
    size: 2,
    note: '',
    key: crypto.randomUUID(),
    client: (++sequence).toString(16).padStart(64, '0'),
    ...overrides,
  };
  await db.exec('set role app_runtime');
  try {
    return (
      await db.query<{ result: { status: number; id?: string } }>(
        'select public.submit_guest_rsvp($1,$2,$3,$4,$5,$6,$7,$8) result',
        Object.values(args),
      )
    ).rows[0].result;
  } finally {
    await db.exec('reset role');
  }
}
async function asActor<T>(id: string | null, callback: () => Promise<T>) {
  await db.exec('set role app_runtime;begin');
  try {
    await db.query("select set_config('app.user_id',$1,true)", [id ?? '']);
    return await callback();
  } finally {
    await db.exec('rollback;reset role');
  }
}
it('el enlace revela solo su destinatario y no sirve para otro evento', async () => {
  await asActor(null, async () => {
    expect((await db.query('select * from event_guests')).rows).toHaveLength(0);
    const rows = (
      await db.query<{ name: string }>(
        'select * from public.resolve_guest_invitation($1,$2)',
        ['named-event', guestTokenHash(tokens[0])],
      )
    ).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Ana Pérez');
    expect(Object.keys(rows[0]).sort()).toEqual([
      'attendance',
      'id',
      'max_party_size',
      'name',
      'party_size',
    ]);
    expect(
      (
        await db.query('select * from public.resolve_guest_invitation($1,$2)', [
          'other-event',
          guestTokenHash(tokens[0]),
        ])
      ).rows,
    ).toHaveLength(0);
  });
});
it('RLS aísla los registros y prohíbe crear o modificar invitados ajenos', async () => {
  await asActor(owner, async () => {
    expect(
      (await db.query('select id from event_guests order by id')).rows,
    ).toEqual([{ id: alice }, { id: bob }]);
  });
  await asActor(other, async () => {
    expect((await db.query('select id from event_guests')).rows).toEqual([
      { id: cara },
    ]);
    expect(
      (
        await db.query(
          "update event_guests set name='Intrusión' where id=$1 returning id",
          [alice],
        )
      ).rows,
    ).toHaveLength(0);
  });
  await asActor(other, async () => {
    await expect(
      db.query(
        "insert into event_guests(id,event_id,name,token_nonce,token_hash) values(gen_random_uuid(),$1,'Intrusión',gen_random_uuid(),repeat('f',64))",
        [event],
      ),
    ).rejects.toThrow(/row-level security/);
  });
});
it('no permite asociar una respuesta al invitado de otro evento', async () => {
  await db.exec('begin');
  try {
    await db.query(
      "insert into rsvps(event_id,guest_id,guest_name,attendance,party_size,idempotency_key) values($1,$2,'Bruno',true,1,gen_random_uuid())",
      [second, bob],
    );
    await expect(
      db.exec('set constraints public.reply_matches_guest_event immediate'),
    ).rejects.toThrow(/foreign key constraint/);
  } finally {
    await db.exec('rollback');
  }
});
it('rechaza tokens inválidos, cupos propios y destinos equivocados sin insertar', async () => {
  expect((await submit({ hash: 'f'.repeat(64) })).status).toBe(404);
  expect((await submit({ slug: 'other-event' })).status).toBe(404);
  expect((await submit({ size: 3 })).status).toBe(409);
  expect((await db.query('select id from rsvps')).rows).toHaveLength(0);
});
it('guarda una sola respuesta por invitación incluso con claves de reintento nuevas', async () => {
  const first = await submit({ key });
  expect(first.status).toBe(201);
  expect((await submit()).status).toBe(200);
  expect((await submit({ size: 1 })).status).toBe(409);
  const rows = (
    await db.query<{ guest_id: string; guest_name: string }>(
      'select guest_id,guest_name from rsvps',
    )
  ).rows;
  expect(rows).toEqual([{ guest_id: alice, guest_name: 'Ana Pérez' }]);
  await expect(
    db.query("update event_guests set name='Otra persona' where id=$1", [
      alice,
    ]),
  ).rejects.toThrow(/Guest already replied/);
});
it('el RSVP abierto no reutiliza la respuesta individual ni descuenta otros pendientes', async () => {
  const args = [
    'named-event',
    'Ana Pérez',
    '',
    true,
    2,
    '',
    key,
    'a'.repeat(64),
  ];
  expect(
    (
      await db.query<{ result: { status: number } }>(
        'select public.submit_rsvp($1,$2,$3,$4,$5,$6,$7,$8) result',
        args,
      )
    ).rows[0].result.status,
  ).toBe(409);
  args[1] = 'Bruno Ruiz';
  args[6] = crypto.randomUUID();
  expect(
    (
      await db.query<{ result: { status: number } }>(
        'select public.submit_rsvp($1,$2,$3,$4,$5,$6,$7,$8) result',
        args,
      )
    ).rows[0].result.status,
  ).toBe(201);
  expect(
    (
      await db.query(
        'select id from event_guests g where event_id=$1 and not exists(select 1 from rsvps r where r.guest_id=g.id)',
        [event],
      )
    ).rows,
  ).toEqual([{ id: bob }]);
  expect(
    (await submit({ hash: guestTokenHash(tokens[1]), size: 1 })).status,
  ).toBe(409);
  expect(
    (
      await submit({
        hash: guestTokenHash(tokens[1]),
        size: 1,
        attendance: false,
      })
    ).status,
  ).toBe(201);
});
it('renovar y revocar conserva la respuesta y cancela el enlace anterior', async () => {
  const renewed = guestTokenHash('4'.repeat(64));
  await db.query(
    'update event_guests set token_nonce=gen_random_uuid(),token_hash=$1 where id=$2',
    [renewed, alice],
  );
  expect((await submit()).status).toBe(404);
  expect((await submit({ hash: renewed })).status).toBe(200);
  await db.query('update event_guests set revoked_at=now() where id=$1', [
    alice,
  ]);
  expect((await submit({ hash: renewed })).status).toBe(404);
  expect(
    (await db.query('select id from rsvps where guest_id=$1', [alice])).rows,
  ).toHaveLength(1);
});
it('respeta cierre, borrador y el límite persistente de intentos', async () => {
  await db.query('update events set rsvp_open=false where id=$1', [second]);
  expect(
    (
      await submit({
        slug: 'other-event',
        hash: guestTokenHash(tokens[2]),
        size: 1,
      })
    ).status,
  ).toBe(409);
  await db.query('update events set published_at=null where id=$1', [second]);
  expect(
    (
      await submit({
        slug: 'other-event',
        hash: guestTokenHash(tokens[2]),
        size: 1,
      })
    ).status,
  ).toBe(404);
  for (let i = 0; i < 10; i++) await submit({ client: 'b'.repeat(64) });
  expect((await submit({ client: 'b'.repeat(64) })).status).toBe(429);
});
it('el evento se elimina con invitados y respuestas sin dejar relaciones huérfanas', async () => {
  await db.query('delete from events where id=$1', [event]);
  expect(
    (await db.query('select id from event_guests where event_id=$1', [event]))
      .rows,
  ).toHaveLength(0);
  expect(
    (await db.query('select id from rsvps where event_id=$1', [event])).rows,
  ).toHaveLength(0);
});

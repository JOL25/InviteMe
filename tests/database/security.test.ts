import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';

let db: PGlite;
const owner = '11111111-1111-4111-8111-111111111111';
const stranger = '22222222-2222-4222-8222-222222222222';
const eventId = '33333333-3333-4333-8333-333333333333';
beforeAll(async () => {
  db = new PGlite();
  for (const file of readdirSync('database/migrations')
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    await db.exec(readFileSync(`database/migrations/${file}`, 'utf8'));
  }
  await db.query(
    "insert into app_users(id,email,password_hash) values($1,'owner@test.local','test'),($2,'stranger@test.local','test')",
    [owner, stranger],
  );
  await db.query(
    `insert into public.events(id,owner_id,slug,title,starts_at,venue_name,message,capacity,published_at)
    values($1,$2,'test-event','Nuestra boda','2027-06-18T22:30:00Z','Jardín','Te esperamos',3,now())`,
    [eventId, owner],
  );
});
afterAll(async () => {
  await db?.close();
});
async function submit(overrides: Record<string, unknown> = {}) {
  const args = {
    slug: 'test-event',
    name: 'María Pérez',
    email: '',
    attendance: true,
    size: 2,
    note: '',
    key: crypto.randomUUID(),
    hash: 'a'.repeat(64),
    ...overrides,
  };
  {
    const result = await db.query<{ result: { status: number; id?: string } }>(
      'select public.submit_rsvp($1,$2,$3,$4,$5,$6,$7,$8) result',
      Object.values(args),
    );
    return result.rows[0].result;
  }
}
describe('RSVP transaccional', () => {
  const key = '44444444-4444-4444-8444-444444444444';
  it('rechaza partySize=0 sin escribir', async () => {
    expect((await submit({ size: 0 })).status).toBe(400);
    expect((await db.query('select * from public.rsvps')).rows).toHaveLength(0);
  });
  it('guarda una confirmación y deduplica reintentos', async () => {
    const first = await submit({ key });
    const retry = await submit({ key });
    expect(first.status).toBe(201);
    expect(retry).toEqual({ status: 200, id: first.id, success: true });
    expect((await db.query('select * from public.rsvps')).rows).toHaveLength(1);
    expect((await submit({ key, size: 1 })).status).toBe(409);
  });
  it('no supera el cupo y las respuestas negativas no consumen capacidad', async () => {
    expect((await submit()).status).toBe(409);
    expect((await submit({ attendance: false, size: 10 })).status).toBe(201);
    expect((await submit({ size: 1 })).status).toBe(201);
    expect((await submit({ size: 1 })).status).toBe(409);
    const count = await db.query<{ total: string }>(
      'select sum(party_size)::text total from public.rsvps where attendance',
    );
    expect(count.rows[0].total).toBe('3');
  });
  it('impide bajar capacidad por debajo de los confirmados', async () => {
    {
      await expect(
        db.query('update public.events set capacity=2 where id=$1', [eventId]),
      ).rejects.toThrow(/Capacity below/);
    }
  });
  it('respeta cerrado, borrador y límite de intentos', async () => {
    await db.query('update public.events set rsvp_open=false where id=$1', [
      eventId,
    ]);
    expect((await submit({ hash: 'b'.repeat(64) })).status).toBe(409);
    await db.query('update public.events set published_at=null where id=$1', [
      eventId,
    ]);
    expect((await submit({ hash: 'b'.repeat(64) })).status).toBe(404);
    for (let i = 0; i < 8; i++) await submit({ hash: 'b'.repeat(64) });
    expect((await submit({ hash: 'b'.repeat(64) })).status).toBe(429);
  });
});

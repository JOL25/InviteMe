import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';

let db: PGlite;
const owner = '11111111-1111-4111-8111-111111111111';
const stranger = '22222222-2222-4222-8222-222222222222';
const eventId = '33333333-3333-4333-8333-333333333333';
beforeAll(async () => {
  db = new PGlite();
  // Minimal Supabase platform fixtures, not application mocks: migrations and RLS
  // below run in actual PostgreSQL compiled to WASM.
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql immutable as
      $$select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1]$$;
    grant usage on schema storage to authenticated;
    grant all on storage.objects to authenticated;
    insert into auth.users values ('${owner}'),('${stranger}');
  `);
  for (const file of readdirSync('supabase/migrations')
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
  }
  await db.query(
    `insert into public.events(id,owner_id,slug,title,starts_at,venue_name,message,capacity,published_at)
    values($1,$2,'test-event','Nuestra boda','2027-06-18T22:30:00Z','Jardín','Te esperamos',3,now())`,
    [eventId, owner],
  );
});
afterAll(async () => {
  await db?.close();
});
async function asUser<T>(id: string, callback: () => Promise<T>) {
  await db.exec(
    `set role authenticated; set "request.jwt.claim.sub" = '${id}';`,
  );
  try {
    return await callback();
  } finally {
    await db.exec('reset role; reset "request.jwt.claim.sub";');
  }
}
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
  await db.exec('set role service_role');
  try {
    const result = await db.query<{ result: { status: number; id?: string } }>(
      'select public.submit_rsvp($1,$2,$3,$4,$5,$6,$7,$8) result',
      Object.values(args),
    );
    return result.rows[0].result;
  } finally {
    await db.exec('reset role');
  }
}
describe('permisos reales de PostgreSQL', () => {
  it('un propietario ve su evento y otro usuario no puede leerlo ni actualizarlo', async () => {
    await asUser(owner, async () =>
      expect(
        (await db.query('select id from public.events')).rows,
      ).toHaveLength(1),
    );
    await asUser(stranger, async () => {
      expect(
        (await db.query('select id from public.events')).rows,
      ).toHaveLength(0);
      expect(
        (
          await db.query(
            "update public.events set title='Intrusión' returning id",
          )
        ).rows,
      ).toHaveLength(0);
    });
  });
  it('anon no puede leer eventos ni insertar RSVP ni ejecutar la función', async () => {
    await db.exec('set role anon');
    try {
      await expect(db.query('select * from public.events')).rejects.toThrow(
        /permission denied/,
      );
      await expect(db.query('select * from public.rsvps')).rejects.toThrow(
        /permission denied/,
      );
      await expect(
        db.query(
          "select public.submit_rsvp('x','María','',true,1,'',gen_random_uuid(),repeat('a',64))",
        ),
      ).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec('reset role');
    }
  });
  it('un usuario no puede transferir el evento ni asignar una portada ajena', async () => {
    await asUser(owner, async () => {
      await expect(
        db.query('update public.events set owner_id=$1 where id=$2', [
          stranger,
          eventId,
        ]),
      ).rejects.toThrow();
      await expect(
        db.query('update public.events set cover_path=$1 where id=$2', [
          `${stranger}/${eventId}/abc.jpg`,
          eventId,
        ]),
      ).rejects.toThrow();
    });
  });
  it('Storage solo permite al dueño crear y leer archivos de su evento', async () => {
    await asUser(owner, async () => {
      await db.query(
        "insert into storage.objects(bucket_id,name) values('covers',$1)",
        [`${owner}/${eventId}/abc.jpg`],
      );
      expect(
        (await db.query('select * from storage.objects')).rows,
      ).toHaveLength(1);
    });
    await asUser(stranger, async () => {
      expect(
        (await db.query('select * from storage.objects')).rows,
      ).toHaveLength(0);
      await expect(
        db.query(
          "insert into storage.objects(bucket_id,name) values('covers',$1)",
          [`${owner}/${eventId}/def.jpg`],
        ),
      ).rejects.toThrow();
    });
  });
});
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
    await asUser(owner, async () => {
      await expect(
        db.query('update public.events set capacity=2 where id=$1', [eventId]),
      ).rejects.toThrow(/Capacity below/);
    });
  });
  it('solo el dueño puede ver respuestas', async () => {
    await asUser(owner, async () =>
      expect((await db.query('select * from public.rsvps')).rows).toHaveLength(
        3,
      ),
    );
    await asUser(stranger, async () =>
      expect((await db.query('select * from public.rsvps')).rows).toHaveLength(
        0,
      ),
    );
  });
  it('los agregados no revelan respuestas de otro propietario', async () => {
    await asUser(owner, async () => {
      const result = await db.query<{ attendee_count: number }>(
        'select * from public.guest_summary($1)',
        [eventId],
      );
      expect(Number(result.rows[0].attendee_count)).toBe(3);
    });
    await asUser(stranger, async () => {
      const result = await db.query<{ attendee_count: number }>(
        'select * from public.guest_summary($1)',
        [eventId],
      );
      expect(Number(result.rows[0].attendee_count)).toBe(0);
    });
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

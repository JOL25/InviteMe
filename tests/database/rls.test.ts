import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { beforeAll, afterAll, it, expect } from 'vitest';
import { grantRuntime } from '../../scripts/runtime-grants.mjs';
let db: PGlite;
const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const first = '33333333-3333-4333-8333-333333333333';
const second = '44444444-4444-4444-8444-444444444444';
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    'create table app_migrations(name text primary key,checksum text not null); create role app_runtime nosuperuser nobypassrls;',
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
  for (const [id, user, slug, published] of [
    [first, owner, 'published-event', true],
    [second, other, 'private-event', false],
  ]) {
    await db.query(
      `insert into events(id,owner_id,slug,title,starts_at,venue_name,message,published_at)
      values($1,$2,$3,'Celebración','2027-01-01','Jardín','Nos vemos',case when $4 then now() else null end)`,
      [id, user, slug, published],
    );
    const path = `${user}/${id}/abc.png`;
    await db.query('update events set cover_path=$1 where id=$2', [path, id]);
    await db.query("insert into covers values($1,$2,'image/png',$3)", [
      id,
      path,
      new Uint8Array([137, 80, 78, 71]),
    ]);
    await db.query(
      "insert into rsvps(event_id,guest_name,attendance,party_size,idempotency_key) values($1,'Invitado',true,1,gen_random_uuid())",
      [id],
    );
    await db.query(
      "insert into event_photos(id,event_id,position,alt_text,content_type,bytes) values($1,$1,0,'Recuerdo familiar','image/png',$2)",
      [id, new Uint8Array([137, 80, 78, 71])],
    );
  }
});
afterAll(async () => {
  await db?.close();
});
async function asActor<T>(user: string | null, work: () => Promise<T>) {
  await db.exec('set role app_runtime; begin;');
  try {
    await db.query("select set_config('app.user_id',$1,true)", [user ?? '']);
    return await work();
  } finally {
    await db.exec('rollback; reset role;');
  }
}
it('sin identidad no revela tablas, aunque el evento esté publicado', async () => {
  await asActor(null, async () => {
    for (const table of ['events', 'rsvps', 'covers', 'event_photos'])
      expect((await db.query(`select * from ${table}`)).rows).toHaveLength(0);
    const published = (
      await db.query('select * from public.public_invitation($1)', [
        'published-event',
      ])
    ).rows;
    expect(published).toHaveLength(1);
    expect(published[0]).not.toHaveProperty('owner_id');
    expect(
      (
        await db.query('select * from public.public_invitation($1)', [
          'private-event',
        ])
      ).rows,
    ).toHaveLength(0);
  });
});
it('RLS filtra eventos, respuestas y portadas aun sin WHERE owner_id', async () => {
  for (const [user, id] of [
    [owner, first],
    [other, second],
  ])
    await asActor(user, async () => {
      expect((await db.query('select id from events')).rows).toEqual([{ id }]);
      expect((await db.query('select event_id from rsvps')).rows).toEqual([
        { event_id: id },
      ]);
      expect((await db.query('select event_id from covers')).rows).toEqual([
        { event_id: id },
      ]);
      expect(
        (await db.query('select event_id from event_photos')).rows,
      ).toEqual([{ event_id: id }]);
    });
});

it('las fotos públicas no revelan datos de almacenamiento ni borradores', async () => {
  await asActor(null, async () => {
    const photos = (
      await db.query<{ id: string; alt_text: string; caption: string }>(
        'select * from public.invitation_photos($1)',
        ['published-event'],
      )
    ).rows;
    expect(photos).toHaveLength(1);
    expect(Object.keys(photos[0]).sort()).toEqual([
      'alt_text',
      'caption',
      'id',
    ]);
    expect(
      (
        await db.query('select * from public.invitation_photos($1)', [
          'private-event',
        ])
      ).rows,
    ).toHaveLength(0);
    expect(
      (await db.query('select * from public.read_gallery_photo($1)', [first]))
        .rows,
    ).toHaveLength(1);
    expect(
      (await db.query('select * from public.read_gallery_photo($1)', [second]))
        .rows,
    ).toHaveLength(0);
  });
  await asActor(other, async () => {
    expect(
      (await db.query('select * from public.read_gallery_photo($1)', [second]))
        .rows,
    ).toHaveLength(1);
  });
});
it('otro dueño no puede modificar, eliminar o insertar fotos ajenas', async () => {
  await asActor(other, async () => {
    expect(
      (
        await db.query(
          "update event_photos set caption='Intrusión' where id=$1 returning id",
          [first],
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query('delete from event_photos where id=$1 returning id', [
          first,
        ])
      ).rows,
    ).toHaveLength(0);
  });
  await asActor(other, async () => {
    await expect(
      db.query(
        "insert into event_photos(event_id,position,alt_text,content_type,bytes) values($1,1,'Foto ajena','image/png',$2)",
        [first, new Uint8Array([1])],
      ),
    ).rejects.toThrow(/row-level security/);
  });
});
it('el esquema impide una novena foto y el cambio de identidad', async () => {
  await db.exec('begin');
  try {
    for (let position = 1; position < 8; position++)
      await db.query(
        "insert into event_photos(event_id,position,alt_text,content_type,bytes) values($1,$2,'Recuerdo familiar','image/png',$3)",
        [first, position, new Uint8Array([1])],
      );
    await expect(
      db.query(
        "insert into event_photos(event_id,position,alt_text,content_type,bytes) values($1,8,'Novena foto','image/png',$2)",
        [first, new Uint8Array([1])],
      ),
    ).rejects.toThrow(/check constraint/);
  } finally {
    await db.exec('rollback');
  }
  await expect(
    db.query('update event_photos set event_id=$1 where id=$2', [
      second,
      first,
    ]),
  ).rejects.toThrow(/Photo identity is immutable/);
});
it('impide modificar y borrar un evento ajeno y crear eventos a otro dueño', async () => {
  await asActor(other, async () => {
    expect(
      (
        await db.query(
          "update events set title='Intrusión' where id=$1 returning id",
          [first],
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (await db.query('delete from events where id=$1 returning id', [first]))
        .rows,
    ).toHaveLength(0);
  });
  await asActor(other, async () => {
    await expect(
      db.query(
        `insert into events(owner_id,slug,title,starts_at,venue_name,message)
      values($1,'forged-event','Intrusión',now(),'Lugar','Mensaje')`,
        [owner],
      ),
    ).rejects.toThrow(/row-level security/);
  });
});
it('runtime no puede leer cuentas, sesiones, límites o migraciones directamente', async () => {
  for (const table of [
    'app_users',
    'app_sessions',
    'auth_limits',
    'private.rsvp_limits',
    'app_migrations',
  ])
    await asActor(owner, async () => {
      await expect(db.query(`select * from ${table}`)).rejects.toThrow(
        /permission denied/,
      );
    });
});
it('runtime no puede desactivar RLS ni insertar RSVP directamente', async () => {
  await asActor(owner, async () => {
    await expect(
      db.query('alter table events disable row level security'),
    ).rejects.toThrow(/owner/);
  });
  await asActor(owner, async () => {
    await expect(
      db.query(
        "insert into rsvps(event_id,guest_name,attendance,party_size,idempotency_key) values($1,'Intrusión',true,1,gen_random_uuid())",
        [first],
      ),
    ).rejects.toThrow(/permission denied/);
  });
});
it('la proyección de portadas respeta publicación y dueño', async () => {
  await asActor(null, async () => {
    expect(
      (await db.query('select * from public.read_cover($1)', [first])).rows,
    ).toHaveLength(1);
    expect(
      (await db.query('select * from public.read_cover($1)', [second])).rows,
    ).toHaveLength(0);
  });
  await asActor(other, async () => {
    expect(
      (await db.query('select * from public.read_cover($1)', [second])).rows,
    ).toHaveLength(1);
  });
});
it('el contexto no sobrevive al final de una transacción', async () => {
  await db.exec('set role app_runtime; begin;');
  await db.query("select set_config('app.user_id',$1,true)", [owner]);
  await db.exec('commit');
  try {
    expect((await db.query('select * from events')).rows).toHaveLength(0);
  } finally {
    await db.exec('reset role');
  }
});

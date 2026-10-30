import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { beforeAll, afterAll, it, expect } from 'vitest';
import { grantRuntime } from '../../scripts/runtime-grants.mjs';
let db: PGlite;
const owner = '11111111-1111-4111-8111-111111111111',
  other = '22222222-2222-4222-8222-222222222222';
const event = '33333333-3333-4333-8333-333333333333',
  second = '44444444-4444-4444-8444-444444444444';
const activity = '55555555-5555-4555-8555-555555555555';
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
    [event, owner, 'itinerary-event'],
    [second, other, 'private-event'],
  ]) {
    await db.query(
      "insert into events(id,owner_id,slug,title,starts_at,venue_name,message) values($1,$2,$3,'Celebración',now(),'Jardín','Nos vemos')",
      [id, user, slug],
    );
    await db.query(
      "insert into event_activities(id,event_id,title,starts_at) values($1,$2,'Ceremonia','2027-08-20T23:00Z')",
      [id === event ? activity : second, id],
    );
  }
});
afterAll(async () => {
  await db?.close();
});
async function asActor<T>(actor: string, work: () => Promise<T>) {
  await db.exec('set role app_runtime;begin');
  try {
    await db.query("select set_config('app.user_id',$1,true)", [actor]);
    return await work();
  } finally {
    await db.exec('rollback;reset role');
  }
}
it('RLS oculta la lista sin identidad y a otros propietarios', async () => {
  await asActor('', async () =>
    expect(
      (await db.query('select * from event_activities')).rows,
    ).toHaveLength(0),
  );
  await asActor(other, async () => {
    expect(
      (await db.query('select event_id from event_activities')).rows,
    ).toEqual([{ event_id: second }]);
    expect(
      (
        await db.query(
          'delete from event_activities where id=$1 returning id',
          [activity],
        )
      ).rows,
    ).toHaveLength(0);
  });
  await expect(
    asActor(other, () =>
      db.query(
        "insert into event_activities(event_id,title,starts_at) values($1,'Intrusión',now())",
        [event],
      ),
    ),
  ).rejects.toThrow();
});
it('el propietario puede editar sin cambiar la identidad de la actividad', async () => {
  await asActor(owner, async () => {
    expect(
      (
        await db.query(
          "update event_activities set title='Cena' where id=$1 returning title",
          [activity],
        )
      ).rows,
    ).toEqual([{ title: 'Cena' }]);
  });
  await expect(
    asActor(owner, () =>
      db.query('update event_activities set id=gen_random_uuid() where id=$1', [
        activity,
      ]),
    ),
  ).rejects.toThrow('immutable');
  await expect(
    db.query('update event_activities set event_id=$1 where id=$2', [
      second,
      activity,
    ]),
  ).rejects.toThrow('immutable');
});
it('el límite de 20 actividades se aplica en SQL y admite reutilizar un espacio eliminado', async () => {
  await expect(
    asActor(owner, async () => {
      for (let i = 0; i < 19; i++)
        await db.query(
          "insert into event_activities(event_id,title,starts_at) values($1,'Actividad',now())",
          [event],
        );
      expect(
        (await db.query('select id from event_activities')).rows,
      ).toHaveLength(20);
      await db.query('delete from event_activities where id=$1', [activity]);
      await db.query(
        "insert into event_activities(event_id,title,starts_at) values($1,'Reemplazo',now())",
        [event],
      );
      await db.query(
        "insert into event_activities(event_id,title,starts_at) values($1,'Exceso',now())",
        [event],
      );
    }),
  ).rejects.toThrow('limit');
});
it('rechaza fechas infinitas y textos fuera de límite en la base', async () => {
  for (const [title, date] of [
    ['x', '2027-08-20'],
    ['x'.repeat(121), '2027-08-20'],
    ['Cena', 'infinity'],
  ])
    await expect(
      db.query(
        'insert into event_activities(event_id,title,starts_at) values($1,$2,$3)',
        [event, title, date],
      ),
    ).rejects.toThrow();
});
it('la proyección pública exige publicación y solo expone los campos del itinerario', async () => {
  await asActor('', async () =>
    expect(
      (await db.query("select * from invitation_activities('itinerary-event')"))
        .rows,
    ).toHaveLength(0),
  );
  await db.query('update events set published_at=now() where id=$1', [event]);
  await db.query(
    "insert into event_activities(event_id,title,starts_at) values($1,'Recepción','2027-08-20T22:00Z')",
    [event],
  );
  await asActor('', async () => {
    const rows = (
      await db.query<{ title: string }>(
        "select * from invitation_activities('itinerary-event')",
      )
    ).rows;
    expect(rows.map((r) => r.title)).toEqual(['Recepción', 'Ceremonia']);
    expect(Object.keys(rows[0]).sort()).toEqual([
      'description',
      'id',
      'starts_at',
      'title',
      'venue_name',
    ]);
    expect(
      (await db.query("select * from invitation_activities('private-event')"))
        .rows,
    ).toHaveLength(0);
  });
  await db.query('update events set published_at=null where id=$1', [event]);
  await asActor('', async () =>
    expect(
      (await db.query("select * from invitation_activities('itinerary-event')"))
        .rows,
    ).toHaveLength(0),
  );
});
it('el borrado del evento elimina su itinerario', async () => {
  await db.query('delete from events where id=$1', [event]);
  expect(
    (
      await db.query('select * from event_activities where event_id=$1', [
        event,
      ])
    ).rows,
  ).toHaveLength(0);
});

import 'server-only';
import { randomUUID } from 'node:crypto';
import { database, query } from '@/lib/db';
import type { Event, RSVP } from '@/types/database';
import type { eventValues } from '@/lib/validators';

// All private operations take the authenticated owner, never a form owner_id.
export async function findOwnedEvent(id: string, ownerId: string) {
  return (
    (
      await query<Event>('select * from events where id=$1 and owner_id=$2', [
        id,
        ownerId,
      ])
    ).rows[0] ?? null
  );
}
export async function listOwnedEvents(
  ownerId: string,
  search: string,
  page: number,
) {
  const values = [ownerId, `%${search}%`];
  const { rows } = await query<Event>(
    'select * from events where owner_id=$1 and title ilike $2 order by created_at desc,id limit 12 offset $3',
    [...values, (page - 1) * 12],
  );
  const count = (
    await query<{ count: number }>(
      'select count(*)::int count from events where owner_id=$1 and title ilike $2',
      values,
    )
  ).rows[0].count;
  return { data: rows, count };
}
export async function writeEvent(
  ownerId: string,
  id: string,
  data: ReturnType<typeof eventValues>,
  slug: string,
) {
  const columns = [
    'title',
    'category',
    'timezone',
    'starts_at',
    'venue_name',
    'venue_address',
    'map_url',
    'capacity',
    'message',
    'primary_color',
    'accent_color',
    'rsvp_open',
  ] as const;
  const values = columns.map((key) => data[key]);
  if (id) {
    return (
      await query<{ id: string }>(
        `update events set ${columns.map((key, i) => `${key}=$${i + 1}`).join(',')} where id=$13 and owner_id=$14 returning id`,
        [...values, id, ownerId],
      )
    ).rows[0];
  }
  return (
    await query<{ id: string }>(
      `insert into events(${columns.join(',')},owner_id,slug) values(${columns.map((_, i) => `$${i + 1}`).join(',')},$13,$14) returning id`,
      [...values, ownerId, slug],
    )
  ).rows[0];
}
export async function setPublication(
  id: string,
  ownerId: string,
  publish: boolean,
) {
  return (
    (
      await query(
        'update events set published_at=$1 where id=$2 and owner_id=$3 returning id',
        [publish ? new Date().toISOString() : null, id, ownerId],
      )
    ).rowCount === 1
  );
}
export async function removeEvent(id: string, ownerId: string) {
  return (
    (
      await query(
        'delete from events where id=$1 and owner_id=$2 returning id',
        [id, ownerId],
      )
    ).rowCount === 1
  );
}
export async function ownedReplies(
  id: string,
  ownerId: string,
  attendance: string,
  page: number,
) {
  const filter =
    attendance === 'yes' ? true : attendance === 'no' ? false : null;
  const args = [id, ownerId, filter];
  const predicate =
    'r.event_id=$1 and e.owner_id=$2 and ($3::boolean is null or r.attendance=$3)';
  const rows = (
    await query<RSVP>(
      `select r.* from rsvps r join events e on e.id=r.event_id where ${predicate} order by r.created_at desc,r.id limit 50 offset $4`,
      [...args, (page - 1) * 50],
    )
  ).rows;
  const count = (
    await query<{ count: number }>(
      `select count(*)::int count from rsvps r join events e on e.id=r.event_id where ${predicate}`,
      args,
    )
  ).rows[0].count;
  const summary = (
    await query<{
      yes_count: number;
      no_count: number;
      attendee_count: number;
    }>(
      `select count(*) filter(where r.attendance)::int yes_count, count(*) filter(where not r.attendance)::int no_count,
    coalesce(sum(r.party_size) filter(where r.attendance),0)::int attendee_count
    from rsvps r join events e on e.id=r.event_id where r.event_id=$1 and e.owner_id=$2`,
      [id, ownerId],
    )
  ).rows[0];
  return { rows, count, summary };
}
export const coverUrl = (path: string | null) =>
  path
    ? `/api/covers/${path.split('/')[1]}?v=${encodeURIComponent(path.split('/')[2])}`
    : null;
export async function storeCover(
  id: string,
  ownerId: string,
  bytes: Buffer,
  ext: 'jpg' | 'png' | 'webp',
) {
  const client = await database().connect();
  try {
    await client.query('begin');
    const event = await client.query(
      'select id from events where id=$1 and owner_id=$2 for update',
      [id, ownerId],
    );
    if (!event.rowCount) {
      await client.query('rollback');
      return false;
    }
    const path = `${ownerId}/${id}/${randomUUID()}.${ext}`;
    await client.query(
      `insert into covers(event_id,path,content_type,bytes) values($1,$2,$3,$4)
      on conflict(event_id) do update set path=excluded.path,content_type=excluded.content_type,bytes=excluded.bytes`,
      [id, path, ext === 'jpg' ? 'image/jpeg' : `image/${ext}`, bytes],
    );
    await client.query(
      'update events set cover_path=$1 where id=$2 and owner_id=$3',
      [path, id, ownerId],
    );
    await client.query('commit');
    return true;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

import 'server-only';
import type { PoolClient } from 'pg';
import { forOwner, ownerTransaction } from '@/lib/db';
import { maxGalleryPhotos } from '@/lib/gallery-rules';
import type { GalleryItem, GalleryPhoto } from '@/types/database';

export const photoUrl = (id: string) => `/api/photos/${id}`;
export function projectPhotos(
  photos: Pick<GalleryItem, 'id' | 'alt_text' | 'caption'>[],
): GalleryPhoto[] {
  return photos.map(({ id, alt_text, caption }) => ({
    id,
    alt_text,
    caption,
    url: photoUrl(id),
  }));
}
export async function ownedGallery(eventId: string, ownerId: string) {
  return (
    await forOwner(ownerId)<GalleryItem>(
      `select p.id,p.event_id,p.position,p.alt_text,p.caption from event_photos p
     join events e on e.id=p.event_id where e.id=$1 and e.owner_id=$2 order by p.position,p.id`,
      [eventId, ownerId],
    )
  ).rows;
}
async function lockEvent(client: PoolClient, eventId: string, ownerId: string) {
  return (
    (
      await client.query(
        'select id from events where id=$1 and owner_id=$2 for update',
        [eventId, ownerId],
      )
    ).rowCount === 1
  );
}
async function compact(client: PoolClient, eventId: string) {
  await client.query(
    'set constraints public.event_photos_position_unique deferred',
  );
  await client.query(
    `with ordered as(select id,(row_number() over(order by position,id)-1)::int next_position
    from event_photos where event_id=$1)
    update event_photos p set position=o.next_position from ordered o where p.id=o.id`,
    [eventId],
  );
}
export async function addGalleryPhoto(
  eventId: string,
  ownerId: string,
  details: { alt_text: string; caption: string },
  bytes: Buffer,
  contentType: string,
) {
  return ownerTransaction(ownerId, async (client) => {
    if (!(await lockEvent(client, eventId, ownerId))) return 'missing' as const;
    const count = (
      await client.query<{ count: number }>(
        'select count(*)::int count from event_photos where event_id=$1',
        [eventId],
      )
    ).rows[0].count;
    if (count >= maxGalleryPhotos) return 'full' as const;
    await compact(client, eventId);
    await client.query(
      `insert into event_photos(event_id,position,alt_text,caption,bytes,content_type) values($1,$2,$3,$4,$5,$6)`,
      [eventId, count, details.alt_text, details.caption, bytes, contentType],
    );
    return 'saved' as const;
  });
}
export async function editGalleryPhoto(
  eventId: string,
  ownerId: string,
  photoId: string,
  details: { alt_text: string; caption: string },
) {
  return (
    (
      await forOwner(ownerId)(
        `update event_photos p set alt_text=$1,caption=$2
    from events e where p.event_id=e.id and e.id=$3 and e.owner_id=$4 and p.id=$5 returning p.id`,
        [details.alt_text, details.caption, eventId, ownerId, photoId],
      )
    ).rowCount === 1
  );
}
export async function changeGalleryPhoto(
  eventId: string,
  ownerId: string,
  photoId: string,
  intent: 'earlier' | 'later' | 'delete',
) {
  return ownerTransaction(ownerId, async (client) => {
    if (!(await lockEvent(client, eventId, ownerId))) return false;
    const photos = (
      await client.query<{ id: string; position: number }>(
        'select id,position from event_photos where event_id=$1 order by position,id',
        [eventId],
      )
    ).rows;
    const index = photos.findIndex((photo) => photo.id === photoId);
    if (index < 0) return false;
    if (intent === 'delete') {
      await client.query(
        'delete from event_photos where id=$1 and event_id=$2',
        [photoId, eventId],
      );
      await compact(client, eventId);
    } else {
      const neighbour = photos[index + (intent === 'earlier' ? -1 : 1)];
      if (!neighbour) return true;
      await client.query(
        'set constraints public.event_photos_position_unique deferred',
      );
      await client.query(
        `update event_photos set position=case when id=$1 then $2::integer else $3::integer end
        where event_id=$4 and id in($1,$5)`,
        [
          photoId,
          neighbour.position,
          photos[index].position,
          eventId,
          neighbour.id,
        ],
      );
    }
    return true;
  });
}

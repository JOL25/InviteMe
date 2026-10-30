import 'server-only';
import { forOwner, ownerTransaction } from '@/lib/db';
import { activityInstant, maxActivities } from '@/lib/itinerary-rules';
import type { Activity } from '@/types/database';
export async function ownedActivities(eventId: string, ownerId: string) {
  return (
    await forOwner(ownerId)<Activity>(
      `select a.id,a.title,a.description,a.venue_name,a.starts_at from event_activities a
    join events e on e.id=a.event_id where a.event_id=$1 and e.owner_id=$2 order by a.starts_at,a.id`,
      [eventId, ownerId],
    )
  ).rows;
}
export async function saveActivity(
  eventId: string,
  ownerId: string,
  id: string,
  details: {
    title: string;
    description: string;
    venue_name: string;
    localDate: string;
  },
) {
  return ownerTransaction(ownerId, async (client) => {
    const event = (
      await client.query<{ timezone: string }>(
        'select timezone from events where id=$1 and owner_id=$2 for update',
        [eventId, ownerId],
      )
    ).rows[0];
    if (!event) return 'missing';
    const instant = activityInstant(details.localDate, event.timezone);
    if (!instant) return 'date';
    if (id) {
      const result = await client.query(
        'update event_activities set title=$1,description=$2,venue_name=$3,starts_at=$4 where id=$5 and event_id=$6 returning id',
        [
          details.title,
          details.description,
          details.venue_name,
          instant,
          id,
          eventId,
        ],
      );
      return result.rowCount === 1 ? 'saved' : 'missing';
    }
    const count = (
      await client.query<{ count: number }>(
        'select count(*)::int count from event_activities where event_id=$1',
        [eventId],
      )
    ).rows[0].count;
    if (count >= maxActivities) return 'full';
    await client.query(
      'insert into event_activities(event_id,title,description,venue_name,starts_at) values($1,$2,$3,$4,$5)',
      [
        eventId,
        details.title,
        details.description,
        details.venue_name,
        instant,
      ],
    );
    return 'saved';
  });
}
export async function deleteActivity(
  eventId: string,
  ownerId: string,
  id: string,
) {
  return ownerTransaction(ownerId, async (client) => {
    if (
      !(
        await client.query(
          'select id from events where id=$1 and owner_id=$2 for update',
          [eventId, ownerId],
        )
      ).rowCount
    )
      return false;
    return (
      (
        await client.query(
          'delete from event_activities where id=$1 and event_id=$2 returning id',
          [id, eventId],
        )
      ).rowCount === 1
    );
  });
}

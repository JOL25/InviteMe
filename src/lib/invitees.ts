import 'server-only';
import { randomUUID } from 'node:crypto';
import { forOwner, ownerTransaction } from '@/lib/db';
import { guestToken, guestTokenHash, tokenMatches } from '@/lib/invite-tokens';
import { siteUrl } from '@/lib/env';
export type GuestDetails = {
  name: string;
  email: string;
  max_party_size: number;
};
type GuestRow = GuestDetails & {
  id: string;
  event_id: string;
  token_nonce: string;
  token_hash: string;
  revoked_at: string | null;
  attendance: boolean | null;
  party_size: number | null;
};
export type InvitedGuest = GuestDetails & {
  id: string;
  revoked: boolean;
  attendance: boolean | null;
  party_size: number | null;
  url: string | null;
};
export type InviteSummary = {
  total: number;
  pending: number;
  yes_count: number;
  no_count: number;
};
function displayGuest(row: GuestRow, slug: string): InvitedGuest {
  let url: string | null = null;
  if (!row.revoked_at)
    try {
      const token = guestToken(row.id, row.token_nonce);
      if (tokenMatches(token, row.token_hash))
        url = `${siteUrl()}/i/${slug}#invitado=${token}`;
    } catch {
      /* Existing records remain manageable if the link secret is unavailable. */
    }
  return {
    id: row.id,
    name: row.name,
    email: row.email ?? '',
    max_party_size: row.max_party_size,
    attendance: row.attendance,
    party_size: row.party_size,
    revoked: Boolean(row.revoked_at),
    url,
  };
}
export async function inviteSummary(eventId: string, ownerId: string) {
  return (
    await forOwner(ownerId)<InviteSummary>(
      `select count(*)::int total,
    count(*) filter(where r.id is null)::int pending,
    count(*) filter(where r.attendance)::int yes_count,
    count(*) filter(where not r.attendance)::int no_count
    from event_guests g join events e on e.id=g.event_id left join rsvps r on r.guest_id=g.id
    where e.id=$1 and e.owner_id=$2`,
      [eventId, ownerId],
    )
  ).rows[0];
}
export async function ownedInvitees(
  eventId: string,
  ownerId: string,
  slug: string,
  page: number,
  status: string,
) {
  const query = forOwner(ownerId);
  const where = `g.event_id=$1 and e.owner_id=$2 and
    ($3='all' or ($3='pending' and r.id is null) or ($3='yes' and r.attendance) or ($3='no' and not r.attendance))`;
  const args = [eventId, ownerId, status];
  const { rows } = await query<GuestRow>(
    `select g.*,r.attendance,r.party_size from event_guests g join events e on e.id=g.event_id
    left join rsvps r on r.guest_id=g.id where ${where} order by g.created_at,g.id limit 50 offset $4`,
    [...args, (page - 1) * 50],
  );
  const count = (
    await query<{ count: number }>(
      `select count(*)::int count from event_guests g join events e on e.id=g.event_id
    left join rsvps r on r.guest_id=g.id where ${where}`,
      args,
    )
  ).rows[0].count;
  return { rows: rows.map((row) => displayGuest(row, slug)), count };
}
export async function createInvitee(
  eventId: string,
  ownerId: string,
  details: GuestDetails,
) {
  const id = randomUUID(),
    nonce = randomUUID();
  const hash = guestTokenHash(guestToken(id, nonce));
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
    await client.query(
      `insert into event_guests(id,event_id,name,email,max_party_size,token_nonce,token_hash)
      values($1,$2,$3,$4,$5,$6,$7)`,
      [
        id,
        eventId,
        details.name,
        details.email || null,
        details.max_party_size,
        nonce,
        hash,
      ],
    );
    return true;
  });
}
export async function updateInvitee(
  eventId: string,
  ownerId: string,
  id: string,
  details: GuestDetails,
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
          `update event_guests g set name=$1,email=$2,max_party_size=$3 where id=$4 and event_id=$5
      and not exists(select 1 from rsvps r where r.guest_id=g.id) returning id`,
          [
            details.name,
            details.email || null,
            details.max_party_size,
            id,
            eventId,
          ],
        )
      ).rowCount === 1
    );
  });
}
export async function manageInvitee(
  eventId: string,
  ownerId: string,
  id: string,
  intent: 'renew' | 'revoke' | 'delete',
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
    if (intent === 'delete')
      return (
        (
          await client.query(
            `delete from event_guests g where id=$1 and event_id=$2
      and not exists(select 1 from rsvps r where r.guest_id=g.id) returning id`,
            [id, eventId],
          )
        ).rowCount === 1
      );
    if (intent === 'revoke')
      return (
        (
          await client.query(
            'update event_guests set revoked_at=now() where id=$1 and event_id=$2 returning id',
            [id, eventId],
          )
        ).rowCount === 1
      );
    const nonce = randomUUID(),
      hash = guestTokenHash(guestToken(id, nonce));
    return (
      (
        await client.query(
          'update event_guests set token_nonce=$1,token_hash=$2,revoked_at=null where id=$3 and event_id=$4 returning id',
          [nonce, hash, id, eventId],
        )
      ).rowCount === 1
    );
  });
}

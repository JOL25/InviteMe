import 'server-only';
import { cache } from 'react';
import { hasDatabase } from '@/lib/env';
import { query } from '@/lib/db';
import { coverUrl } from '@/lib/event-store';
import type { Event, PublicEvent } from '@/types/database';
export function projectPublicEvent(
  event: Pick<
    Event,
    | 'slug'
    | 'title'
    | 'category'
    | 'timezone'
    | 'starts_at'
    | 'venue_name'
    | 'venue_address'
    | 'map_url'
    | 'rsvp_open'
    | 'primary_color'
    | 'accent_color'
    | 'message'
  >,
  cover_url: string | null,
): PublicEvent {
  return {
    slug: event.slug,
    title: event.title,
    category: event.category,
    timezone: event.timezone,
    starts_at: event.starts_at,
    venue_name: event.venue_name,
    venue_address: event.venue_address,
    map_url: event.map_url,
    rsvp_open: event.rsvp_open,
    primary_color: event.primary_color,
    accent_color: event.accent_color,
    message: event.message,
    cover_url,
  };
}
export const getPublicEvent = cache(
  async (slug: string): Promise<PublicEvent | null> => {
    if (!hasDatabase() || !/^[a-z0-9-]{3,150}$/.test(slug)) return null;
    const { rows } = await query<Event>(
      `select slug,title,category,timezone,starts_at,venue_name,venue_address,map_url,rsvp_open,primary_color,accent_color,message,cover_path
       from events where slug=$1 and published_at is not null`,
      [slug],
    );
    const data = rows[0];
    return data ? projectPublicEvent(data, coverUrl(data.cover_path)) : null;
  },
);

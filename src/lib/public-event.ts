import 'server-only';
import { cache } from 'react';
import { hasSupabase } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
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
    if (
      !hasSupabase() ||
      !process.env.SUPABASE_SECRET_KEY ||
      !/^[a-z0-9-]{3,150}$/.test(slug)
    )
      return null;
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('events')
      .select(
        'slug,title,category,timezone,starts_at,venue_name,venue_address,map_url,rsvp_open,primary_color,accent_color,message,cover_path',
      )
      .eq('slug', slug)
      .not('published_at', 'is', null)
      .maybeSingle();
    if (error) throw new Error('No pudimos cargar la invitación.');
    if (!data) return null;
    let cover: string | null = null;
    if (data.cover_path) {
      const { data: image } = await supabase.storage
        .from('covers')
        .createSignedUrl(data.cover_path, 300);
      cover = image?.signedUrl ?? null;
    }
    return projectPublicEvent(data, cover);
  },
);

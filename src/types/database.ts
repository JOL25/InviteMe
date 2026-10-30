export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
export type Event = {
  id: string;
  owner_id: string;
  slug: string;
  title: string;
  category: 'wedding' | 'birthday' | 'graduation' | 'other';
  timezone: string;
  starts_at: string;
  venue_name: string;
  venue_address: string;
  map_url: string;
  capacity: number | null;
  rsvp_open: boolean;
  published_at: string | null;
  template_key: string;
  primary_color: string;
  accent_color: string;
  message: string;
  cover_path: string | null;
  created_at: string;
  updated_at: string;
};
export type RSVP = {
  id: string;
  event_id: string;
  guest_id: string | null;
  guest_name: string;
  guest_email: string | null;
  attendance: boolean;
  party_size: number;
  note: string;
  idempotency_key: string;
  created_at: string;
  cancelled_at?: string | null;
  updated_at?: string;
  revision?: number;
};
export type GalleryItem = {
  id: string;
  event_id: string;
  position: number;
  alt_text: string;
  caption: string;
};
export type GalleryPhoto = {
  id: string;
  url: string;
  alt_text: string;
  caption: string;
};
export type Activity = {
  id: string;
  title: string;
  description: string;
  venue_name: string;
  starts_at: string;
};
export type PublicEvent = Pick<
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
> & {
  cover_url: string | null;
  gallery: GalleryPhoto[];
  itinerary: Activity[];
};

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
  guest_name: string;
  guest_email: string | null;
  attendance: boolean;
  party_size: number;
  note: string;
  idempotency_key: string;
  created_at: string;
};
type Table<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};
export type Database = {
  public: {
    Tables: {
      events: Table<
        Event,
        Pick<
          Event,
          'owner_id' | 'slug' | 'title' | 'starts_at' | 'venue_name' | 'message'
        > &
          Partial<Event>,
        Partial<Event>
      >;
      rsvps: Table<
        RSVP,
        Omit<RSVP, 'id' | 'created_at'> &
          Partial<Pick<RSVP, 'id' | 'created_at'>>,
        Partial<RSVP>
      >;
    };
    Views: Record<string, never>;
    Functions: {
      submit_rsvp: {
        Args: {
          p_slug: string;
          p_guest_name: string;
          p_guest_email: string;
          p_attendance: boolean;
          p_party_size: number;
          p_note: string;
          p_key: string;
          p_client_hash: string;
        };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
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
> & { cover_url: string | null };

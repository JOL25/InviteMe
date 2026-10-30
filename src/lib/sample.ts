import type { PublicEvent } from '@/types/database';
export const sampleEvent: PublicEvent = {
  slug: 'ejemplo',
  title: 'Valentina & Mateo',
  category: 'wedding',
  timezone: 'America/Lima',
  starts_at: '2027-06-18T22:00:00.000Z',
  venue_name: 'Jardín de los Olivos',
  venue_address: 'Lima, Perú',
  map_url: 'https://www.google.com/maps/search/?api=1&query=Lima%2C+Peru',
  rsvp_open: true,
  primary_color: '#18233B',
  accent_color: '#D49D9D',
  message:
    'Hay historias que merecen celebrarse. Después de tantos momentos juntos, queremos compartir el más especial con las personas que hacen nuestra vida más bonita.\n\nNos haría muy felices que nos acompañes.',
  cover_url: null,
  gallery: [],
  itinerary: [],
};

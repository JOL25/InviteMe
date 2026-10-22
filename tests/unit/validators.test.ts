import { describe, expect, it } from 'vitest';
import { eventSchema, eventValues, rsvpSchema } from '@/lib/validators';
const event = {
  title: 'Nuestra boda',
  category: 'wedding',
  timezone: 'America/Lima',
  localDate: '2027-06-18T17:30',
  venue_name: 'Jardín Botánico',
  venue_address: '',
  map_url: '',
  capacity: '',
  message: 'Te esperamos para celebrar.',
  primary_color: '#18233B',
  accent_color: '#D49D9D',
  rsvp_open: true,
};
const rsvp = {
  slug: 'nuestra-boda-a1b2c3',
  guestName: 'María Pérez',
  attendance: true,
  partySize: 2,
  idempotencyKey: '11d46126-7638-451e-b814-535c24941634',
};
describe('validación de eventos', () => {
  it('convierte la hora de Lima a UTC y deja cupo opcional', () => {
    const values = eventValues(eventSchema.parse(event));
    expect(values.starts_at).toBe('2027-06-18T22:30:00.000Z');
    expect(values.capacity).toBeNull();
  });
  it.each(['invalid', '', 'America/Inventada'])(
    'rechaza zona %s',
    (timezone) => {
      expect(eventSchema.safeParse({ ...event, timezone }).success).toBe(false);
    },
  );
  it.each(['2027-02-30T12:00', '2027-03-14T02:30'])(
    'rechaza fecha inexistente %s',
    (localDate) => {
      expect(
        eventSchema.safeParse({
          ...event,
          localDate,
          timezone: 'America/New_York',
        }).success,
      ).toBe(false);
    },
  );
  it.each(['javascript:alert(1)', 'http://maps.example.com', 'no-url'])(
    'rechaza mapa inseguro %s',
    (map_url) => {
      expect(eventSchema.safeParse({ ...event, map_url }).success).toBe(false);
    },
  );
});
describe('RSVP', () => {
  it('permite confirmar sin correo y normaliza el nombre', () => {
    expect(
      rsvpSchema.parse({ ...rsvp, guestName: '  María Pérez  ' }).guestName,
    ).toBe('María Pérez');
  });
  it.each([0, -1, 11, 1.5, '2'])('rechaza asistentes %s', (partySize) => {
    expect(rsvpSchema.safeParse({ ...rsvp, partySize }).success).toBe(false);
  });
  it('rechaza correo inválido, ausencia de idempotencia y honeypot', () => {
    expect(
      rsvpSchema.safeParse({ ...rsvp, guestEmail: 'incorrecto' }).success,
    ).toBe(false);
    expect(
      rsvpSchema.safeParse({ ...rsvp, idempotencyKey: undefined }).success,
    ).toBe(false);
    expect(rsvpSchema.safeParse({ ...rsvp, website: 'spam' }).success).toBe(
      false,
    );
  });
});

import { it, expect } from 'vitest';
import { activityInstant, activitySchema } from '@/lib/itinerary-rules';
it('convierte la hora local de la actividad a un instante independiente del equipo', () => {
  expect(activityInstant('2027-08-20T18:30', 'America/Lima')).toBe(
    '2027-08-20T23:30:00.000Z',
  );
  expect(activityInstant('2027-08-21T01:00', 'America/Lima')).toBe(
    '2027-08-21T06:00:00.000Z',
  );
});
it.each([
  ['2027-02-30T18:00', 'America/Lima'],
  ['2027-03-14T02:30', 'America/New_York'],
  ['2027-08-20T25:00', 'America/Lima'],
  ['2027-08-20T18:00', 'Invalid/Zone'],
])('rechaza fechas inexistentes %s en %s', (date, zone) => {
  expect(activityInstant(date, zone)).toBeNull();
});
it('valida textos, límites y campos opcionales vacíos', () => {
  const details = {
    title: ' Cena ',
    description: '',
    venue_name: '',
    localDate: '2027-08-20T20:00',
  };
  expect(activitySchema.parse(details).title).toBe('Cena');
  for (const change of [
    { title: ' ' },
    { title: 'x'.repeat(121) },
    { description: 'x'.repeat(501) },
    { venue_name: 'x'.repeat(161) },
    { localDate: 'ayer' },
  ])
    expect(activitySchema.safeParse({ ...details, ...change }).success).toBe(
      false,
    );
});

import { it, expect } from 'vitest';
import {
  managementFragment,
  managementPath,
  managementWriteSchema,
} from '@/lib/rsvp-management';
it('solo reconoce capacidades completas de respuesta o invitación', () => {
  const token = 'a'.repeat(64);
  expect(managementFragment(`#respuesta=${token}`)).toEqual({
    kind: 'open',
    token,
  });
  expect(managementFragment(`#invitado=${token}`)).toEqual({
    kind: 'guest',
    token,
  });
  for (const hash of [
    '',
    '#rsvp',
    '#respuesta=',
    '#respuesta=incorrecto',
    `#respuesta=${token}&extra=1`,
  ])
    expect(managementFragment(hash)).toBeNull();
  expect(managementPath('evento', 'open', token)).toBe(
    `/i/evento/manage#respuesta=${token}`,
  );
});
it('valida versiones, cupos y texto sin aceptar controles enviados como identidad', () => {
  const value = {
    slug: 'evento',
    kind: 'guest',
    token: 'a'.repeat(64),
    revision: 1,
    intent: 'update',
    guestName: 'Ana',
    attendance: true,
    partySize: 2,
  };
  expect(managementWriteSchema.safeParse(value).success).toBe(true);
  expect(
    managementWriteSchema.parse({ ...value, id: 'otra-respuesta' }),
  ).not.toHaveProperty('id');
  for (const change of [
    { revision: 0 },
    { revision: 1.5 },
    { partySize: 11 },
    { note: 'x'.repeat(501) },
    { guestEmail: 'inválido' },
    { intent: 'delete' },
  ])
    expect(
      managementWriteSchema.safeParse({ ...value, ...change }).success,
    ).toBe(false);
});

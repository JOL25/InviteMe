import { describe, it, expect } from 'vitest';
import { guestToken, guestTokenHash, tokenMatches } from '@/lib/invite-tokens';
import { guestDetailsSchema, invitationTokenSchema } from '@/lib/invite-rules';
describe('enlaces individuales', () => {
  it('deriva enlaces estables y cambia al renovar o cambiar destinatario', () => {
    const secret = 's'.repeat(64);
    const token = guestToken('guest-1', 'nonce-1', secret);
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(guestToken('guest-1', 'nonce-1', secret)).toBe(token);
    expect(guestToken('guest-1', 'nonce-2', secret)).not.toBe(token);
    expect(guestToken('guest-2', 'nonce-1', secret)).not.toBe(token);
    expect(guestTokenHash(token)).not.toBe(token);
    expect(tokenMatches(token, guestTokenHash(token))).toBe(true);
    expect(
      tokenMatches(
        guestToken('guest-1', 'nonce-2', secret),
        guestTokenHash(token),
      ),
    ).toBe(false);
  });
  it('falla sin un secreto suficientemente largo', () => {
    expect(() => guestToken('id', 'nonce', 'short')).toThrow();
  });
  it.each(['', '0'.repeat(63), 'g'.repeat(64), '../other'])(
    'rechaza token malformado %j',
    (token) => {
      expect(invitationTokenSchema.safeParse(token).success).toBe(false);
    },
  );
  it('valida nombre, correo opcional y cupo incluyendo al invitado', () => {
    expect(
      guestDetailsSchema.parse({
        name: '  Ana Pérez  ',
        email: '',
        max_party_size: '2',
      }),
    ).toEqual({ name: 'Ana Pérez', email: '', max_party_size: 2 });
    for (const size of [0, 11, 1.5, ''])
      expect(
        guestDetailsSchema.safeParse({
          name: 'Ana',
          email: '',
          max_party_size: size,
        }).success,
      ).toBe(false);
    expect(
      guestDetailsSchema.safeParse({
        name: 'Ana',
        email: 'invalid',
        max_party_size: 1,
      }).success,
    ).toBe(false);
  });
});

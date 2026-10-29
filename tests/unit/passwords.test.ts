import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/passwords';
describe('contraseñas locales', () => {
  it('usa sales únicas y valida únicamente la contraseña correcta', async () => {
    const first = await hashPassword('Una contraseña larga 123');
    const second = await hashPassword('Una contraseña larga 123');
    expect(first).not.toEqual(second);
    expect(first).not.toContain('contraseña');
    expect(await verifyPassword('Una contraseña larga 123', first)).toBe(true);
    expect(await verifyPassword('Otra contraseña 123', first)).toBe(false);
    expect(await verifyPassword('Una contraseña larga 123', 'malformed')).toBe(
      false,
    );
  });
});

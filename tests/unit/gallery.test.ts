import { describe, it, expect } from 'vitest';
import { photoDetailsSchema } from '@/lib/gallery-rules';
describe('descripciones de galería', () => {
  it('normaliza el texto y permite un pie vacío', () => {
    expect(
      photoDetailsSchema.parse({
        alt_text: '  Nuestro primer viaje  ',
        caption: '  En Lima  ',
      }),
    ).toEqual({ alt_text: 'Nuestro primer viaje', caption: 'En Lima' });
    expect(
      photoDetailsSchema.parse({ alt_text: 'Nuestra familia' }).caption,
    ).toBe('');
  });
  it.each(['', '  ', 'AB', 'a'.repeat(181)])(
    'rechaza descripción inválida %j',
    (alt_text) => {
      expect(
        photoDetailsSchema.safeParse({ alt_text, caption: '' }).success,
      ).toBe(false);
    },
  );
  it('limita el pie a 180 caracteres', () => {
    expect(
      photoDetailsSchema.safeParse({
        alt_text: 'Nuestro recuerdo',
        caption: 'a'.repeat(180),
      }).success,
    ).toBe(true);
    expect(
      photoDetailsSchema.safeParse({
        alt_text: 'Nuestro recuerdo',
        caption: 'a'.repeat(181),
      }).success,
    ).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { csvCell } from '@/lib/csv';
import { imageExtension } from '@/lib/images';
import { limitedJson } from '@/lib/http';
describe('exportación segura', () => {
  it.each([
    '=HYPERLINK("https://bad")',
    '+1+2',
    '-1+2',
    '@SUM(1)',
    '\t=1',
    '   =1',
    '\n=1',
  ])('neutraliza fórmula %j', (value) => {
    expect(csvCell(value)).toMatch(/^"'/);
  });
  it('escapa comillas, comas y saltos sin perder el nombre', () => {
    expect(csvCell('María, "Pérez"\nLima')).toBe('"María, ""Pérez""\nLima"');
  });
});
describe('portadas', () => {
  it('detecta firmas de imagen sin confiar en extensión ni MIME enviados', () => {
    expect(imageExtension(new Uint8Array([255, 216, 255, 224]))).toBe('jpg');
    expect(
      imageExtension(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])),
    ).toBe('png');
    expect(imageExtension(new TextEncoder().encode('RIFF1234WEBP'))).toBe(
      'webp',
    );
    expect(
      imageExtension(new TextEncoder().encode('<svg onload="alert(1)">')),
    ).toBeNull();
    expect(imageExtension(new Uint8Array())).toBeNull();
  });
});
describe('límites del cuerpo JSON', () => {
  it('acepta JSON pequeño', async () => {
    expect(
      await limitedJson(
        new Request('http://localhost', {
          method: 'POST',
          body: '{"name":"María"}',
        }),
      ),
    ).toEqual({ name: 'María' });
  });
  it('limita incluso cuerpos sin Content-Length', async () => {
    await expect(
      limitedJson(
        new Request('http://localhost', {
          method: 'POST',
          body: 'a'.repeat(17000),
        }),
      ),
    ).rejects.toThrow('too-large');
  });
});

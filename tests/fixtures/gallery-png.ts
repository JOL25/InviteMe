import { crc32, deflateSync } from 'node:zlib';
// Real, decodable PNGs generated locally for tests; no remote photo dependency.
export function galleryPng(variant = 0) {
  const width = 320,
    height = 240;
  const pixels = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const offset = y * (1 + width * 4) + 1 + x * 4;
      pixels[offset] =
        variant % 2
          ? 60 + Math.round((x / width) * 80)
          : 140 + Math.round((y / height) * 70);
      pixels[offset + 1] = 120 + Math.round((y / height) * 70);
      pixels[offset + 2] =
        variant % 2
          ? 170 + Math.round((x / width) * 60)
          : 80 + Math.round((x / width) * 70);
      pixels[offset + 3] = 255;
    }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  function chunk(type: string, data: Buffer) {
    const result = Buffer.alloc(data.length + 12);
    result.writeUInt32BE(data.length, 0);
    result.write(type, 4);
    data.copy(result, 8);
    result.writeUInt32BE(
      crc32(result.subarray(4, data.length + 8)),
      data.length + 8,
    );
    return result;
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

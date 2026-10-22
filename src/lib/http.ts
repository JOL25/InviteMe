export async function limitedJson(
  request: Request,
  maxBytes = 16384,
): Promise<unknown> {
  if (Number(request.headers.get('content-length')) > maxBytes)
    throw new Error('too-large');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('invalid-json');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error('too-large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

import 'server-only';
import { createHmac } from 'node:crypto';
import { hasDatabase } from '@/lib/env';
import { limitedJson } from '@/lib/http';
export function recoveryReply(body: object, status: number) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      ...(status === 429 ? { 'Retry-After': '900' } : {}),
    },
  });
}
export function recoveryKey(value: string) {
  return createHmac('sha256', process.env.RSVP_RATE_LIMIT_SECRET!)
    .update(`inviteme:recovery:v1:${value}`)
    .digest('hex');
}
export async function recoveryRequest(
  request: Request,
): Promise<{ body: unknown; clientHash: string } | { response: Response }> {
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return { response: recoveryReply({ error: 'Origen no permitido.' }, 403) };
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return { response: recoveryReply({ error: 'Usa contenido JSON.' }, 415) };
  let body: unknown;
  try {
    body = await limitedJson(request, 4096);
  } catch {
    return { response: recoveryReply({ error: 'Solicitud inválida.' }, 400) };
  }
  const secret = process.env.RSVP_RATE_LIMIT_SECRET;
  if (!hasDatabase() || !secret || secret.length < 32)
    return {
      response: recoveryReply(
        { error: 'La recuperación no está disponible en este momento.' },
        503,
      ),
    };
  // A remote deployment must replace this header through its trusted proxy.
  const address =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    'local-shared';
  return { body, clientHash: recoveryKey(`ip:${address}`) };
}

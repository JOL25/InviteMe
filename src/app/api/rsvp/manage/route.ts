import { query } from '@/lib/db';
import { limitedJson } from '@/lib/http';
import { managementWriteSchema } from '@/lib/rsvp-management';
import { guestTokenHash } from '@/lib/invite-tokens';
import { rsvpSecurity, rsvpReply as reply } from '@/lib/rsvp-security';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return reply({ error: 'Origen no permitido.' }, 403);
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return reply({ error: 'Usa contenido JSON.' }, 415);
  let body: unknown;
  try {
    body = await limitedJson(request);
  } catch {
    return reply({ error: 'Solicitud inválida.' }, 400);
  }
  const parsed = managementWriteSchema.safeParse(body);
  if (!parsed.success)
    return reply({ error: 'Revisa los datos de tu respuesta.' }, 400);
  const input = parsed.data;
  const security = await rsvpSecurity(request, input.turnstileToken);
  if ('response' in security) return security.response;
  try {
    const { rows } = await query<{
      result: { status: number; error?: string; revision?: number };
    }>('select public.manage_rsvp($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) result', [
      input.slug,
      input.kind,
      guestTokenHash(input.token),
      input.revision,
      input.intent,
      input.guestName,
      input.guestEmail,
      input.attendance,
      input.partySize,
      input.note,
      security.clientHash,
    ]);
    const result = rows[0]?.result;
    if (!result || ![200, 400, 404, 409, 429].includes(result.status))
      return reply({ error: 'No pudimos guardar el cambio.' }, 503);
    return reply(
      result.status === 200
        ? { success: true, revision: result.revision }
        : { error: result.error },
      result.status,
    );
  } catch {
    return reply(
      {
        error:
          'No pudimos guardar el cambio. Recarga los datos para comprobar tu respuesta.',
      },
      503,
    );
  }
}

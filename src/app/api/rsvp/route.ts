import { rsvpSecurity, rsvpReply as reply } from '@/lib/rsvp-security';
import { rsvpSchema } from '@/lib/validators';
import { query } from '@/lib/db';
import { limitedJson } from '@/lib/http';
import { guestTokenHash } from '@/lib/invite-tokens';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin)
    return reply({ error: 'Origen no permitido.' }, 403);
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return reply({ error: 'Usa contenido JSON.' }, 415);
  let body: unknown;
  try {
    body = await limitedJson(request);
  } catch {
    return reply({ error: 'Solicitud inválida o demasiado grande.' }, 400);
  }
  const parsed = rsvpSchema.safeParse(body);
  if (!parsed.success)
    return reply({ error: parsed.error.issues[0].message }, 400);
  const input = parsed.data;
  const security = await rsvpSecurity(request, input.turnstileToken);
  if ('response' in security) return security.response;
  try {
    const { rows } = await query<{
      result: { status: number; id?: string; error?: string };
    }>(
      input.inviteToken
        ? 'select public.submit_guest_rsvp($1,$2,$3,$4,$5,$6,$7,$8) result'
        : input.managementToken
          ? 'select public.submit_managed_rsvp($1,$2,$3,$4,$5,$6,$7,$8,$9) result'
          : 'select public.submit_rsvp($1,$2,$3,$4,$5,$6,$7,$8) result',
      [
        input.slug,
        input.inviteToken ? guestTokenHash(input.inviteToken) : input.guestName,
        input.guestEmail,
        input.attendance,
        input.partySize,
        input.note,
        input.idempotencyKey,
        security.clientHash,
        ...(!input.inviteToken && input.managementToken
          ? [guestTokenHash(input.managementToken)]
          : []),
      ],
    );
    const data = rows[0]?.result;
    if (!data) return reply({ error: 'No pudimos guardar tu respuesta.' }, 503);
    const status = Number(data.status);
    if (![200, 201, 400, 404, 409, 429].includes(status))
      return reply({ error: 'No pudimos guardar tu respuesta.' }, 503);
    return status < 300
      ? reply({ success: true, id: data.id }, status)
      : reply({ error: data.error }, status);
  } catch {
    return reply({ error: 'No pudimos conectar. Inténtalo de nuevo.' }, 503);
  }
}

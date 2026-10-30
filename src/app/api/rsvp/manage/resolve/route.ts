import { query } from '@/lib/db';
import { hasDatabase } from '@/lib/env';
import { limitedJson } from '@/lib/http';
import { managementLookupSchema } from '@/lib/rsvp-management';
import { guestTokenHash } from '@/lib/invite-tokens';
import { rsvpReply as reply } from '@/lib/rsvp-security';
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
  const input = managementLookupSchema.safeParse(body);
  if (!input.success)
    return reply({ error: 'Enlace de gestión inválido.' }, 400);
  if (!hasDatabase()) return reply({ error: 'Servicio no disponible.' }, 503);
  try {
    const { slug, kind, token } = input.data;
    const { rows } = await query(
      'select * from public.resolve_rsvp_management($1,$2,$3)',
      [slug, kind, guestTokenHash(token)],
    );
    return rows[0]
      ? reply(rows[0], 200)
      : reply(
          {
            error:
              'El enlace de gestión no está disponible o aún no tiene una respuesta.',
          },
          404,
        );
  } catch {
    return reply({ error: 'No pudimos consultar tu respuesta.' }, 503);
  }
}

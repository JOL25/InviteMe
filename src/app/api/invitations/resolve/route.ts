import { z } from 'zod';
import { limitedJson } from '@/lib/http';
import { hasDatabase } from '@/lib/env';
import { query } from '@/lib/db';
import { invitationTokenSchema } from '@/lib/invite-rules';
import { guestTokenHash } from '@/lib/invite-tokens';
export const runtime = 'nodejs';
const schema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,150}$/),
  token: invitationTokenSchema,
});
const reply = (body: object, status: number) =>
  Response.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
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
  const input = schema.safeParse(body);
  if (!input.success)
    return reply({ error: 'El enlace individual no es válido.' }, 400);
  if (!hasDatabase())
    return reply({ error: 'El servicio no está disponible.' }, 503);
  try {
    const { rows } = await query<{
      id: string;
      name: string;
      max_party_size: number;
      attendance: boolean | null;
      party_size: number | null;
    }>('select * from public.resolve_guest_invitation($1,$2)', [
      input.data.slug,
      guestTokenHash(input.data.token),
    ]);
    if (!rows[0])
      return reply(
        {
          error:
            'El enlace individual no está disponible. Consulta con quien organiza el evento.',
        },
        404,
      );
    return reply(rows[0], 200);
  } catch {
    return reply(
      { error: 'No pudimos comprobar tu invitación. Inténtalo de nuevo.' },
      503,
    );
  }
}

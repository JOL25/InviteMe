import { createHmac } from 'node:crypto';
import { NextResponse } from 'next/server';
import { rsvpSchema } from '@/lib/validators';
import { query } from '@/lib/db';
import { hasDatabase, siteUrl } from '@/lib/env';
import { limitedJson } from '@/lib/http';
import { guestTokenHash } from '@/lib/invite-tokens';
export const runtime = 'nodejs';
function reply(body: object, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...(status === 429 ? { 'Retry-After': '600' } : {}),
    },
  });
}
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
  const salt = process.env.RSVP_RATE_LIMIT_SECRET;
  if (!hasDatabase() || !salt || salt.length < 32)
    return reply(
      { error: 'Las confirmaciones no están disponibles en este momento.' },
      503,
    );
  const captchaKey = process.env.TURNSTILE_SECRET_KEY;
  const captchaSite = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (Boolean(captchaKey) !== Boolean(captchaSite))
    return reply(
      { error: 'Las confirmaciones no están disponibles en este momento.' },
      503,
    );
  if (captchaKey) {
    if (!input.turnstileToken)
      return reply({ error: 'Completa la verificación antes de enviar.' }, 400);
    try {
      const response = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          body: new URLSearchParams({
            secret: captchaKey,
            response: input.turnstileToken,
          }),
          signal: AbortSignal.timeout(8000),
        },
      );
      const result = await response.json();
      if (
        !result.success ||
        result.hostname !== new URL(siteUrl()).hostname ||
        result.action !== 'rsvp'
      )
        return reply(
          { error: 'La verificación caducó. Inténtalo de nuevo.' },
          400,
        );
    } catch {
      return reply(
        { error: 'No pudimos verificar la solicitud. Inténtalo de nuevo.' },
        503,
      );
    }
  }
  // Vercel replaces x-forwarded-for; another host MUST configure its trusted proxy.
  // Do not trust arbitrary client-supplied forwarded headers on an exposed origin.
  const address =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    'local-shared';
  const hash = createHmac('sha256', salt).update(address).digest('hex');
  try {
    const { rows } = await query<{
      result: { status: number; id?: string; error?: string };
    }>(
      input.inviteToken
        ? 'select public.submit_guest_rsvp($1,$2,$3,$4,$5,$6,$7,$8) result'
        : 'select public.submit_rsvp($1,$2,$3,$4,$5,$6,$7,$8) result',
      [
        input.slug,
        input.inviteToken ? guestTokenHash(input.inviteToken) : input.guestName,
        input.guestEmail,
        input.attendance,
        input.partySize,
        input.note,
        input.idempotencyKey,
        hash,
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

import 'server-only';
import { createHmac } from 'node:crypto';
import { hasDatabase, siteUrl } from '@/lib/env';
export function rsvpReply(body: object, status: number) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      ...(status === 429 ? { 'Retry-After': '600' } : {}),
    },
  });
}
const reply = rsvpReply;
export async function rsvpSecurity(
  request: Request,
  turnstileToken?: string,
): Promise<{ response: Response } | { clientHash: string }> {
  const salt = process.env.RSVP_RATE_LIMIT_SECRET;
  if (!hasDatabase() || !salt || salt.length < 32)
    return {
      response: reply(
        { error: 'Las confirmaciones no están disponibles en este momento.' },
        503,
      ),
    };
  const captchaKey = process.env.TURNSTILE_SECRET_KEY;
  const captchaSite = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (Boolean(captchaKey) !== Boolean(captchaSite))
    return {
      response: reply(
        { error: 'Las confirmaciones no están disponibles en este momento.' },
        503,
      ),
    };
  if (captchaKey) {
    if (!turnstileToken)
      return {
        response: reply(
          { error: 'Completa la verificación antes de enviar.' },
          400,
        ),
      };
    try {
      const response = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          body: new URLSearchParams({
            secret: captchaKey,
            response: turnstileToken,
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
        return {
          response: reply(
            { error: 'La verificación caducó. Inténtalo de nuevo.' },
            400,
          ),
        };
    } catch {
      return {
        response: reply(
          { error: 'No pudimos verificar la solicitud. Inténtalo de nuevo.' },
          503,
        ),
      };
    }
  }
  // Vercel replaces x-forwarded-for; another host MUST configure its trusted proxy.
  // Do not trust arbitrary client-supplied forwarded headers on an exposed origin.
  const address =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    'local-shared';
  const clientHash = createHmac('sha256', salt).update(address).digest('hex');
  return { clientHash };
}

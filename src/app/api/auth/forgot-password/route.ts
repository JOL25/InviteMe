import { randomBytes, createHash } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { query } from '@/lib/db';
import { siteUrl } from '@/lib/env';
import { recoveryMessage, recoveryRequestSchema } from '@/lib/recovery-rules';
import {
  recoveryRequest,
  recoveryReply,
  recoveryKey,
} from '@/lib/recovery-http';
import {
  localRecoveryEnabled,
  localMessages,
  writeLocalMessage,
} from '../../../../../scripts/local-mail.mjs';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  const input = await recoveryRequest(request);
  if ('response' in input) return input.response;
  if (!localRecoveryEnabled())
    return recoveryReply(
      { error: 'La recuperación local no está configurada para este sitio.' },
      503,
    );
  const raw = input.body as { email?: unknown } | null;
  const parsed = recoveryRequestSchema.safeParse({
    email: typeof raw?.email === 'string' ? raw.email.trim().toLowerCase() : '',
  });
  if (!parsed.success)
    return recoveryReply({ error: parsed.error.issues[0].message }, 400);
  const started = performance.now();
  try {
    await localMessages();
    const token = randomBytes(32).toString('hex');
    const hash = createHash('sha256').update(token).digest('hex');
    const { rows } = await query<{ issued: boolean }>(
      'select private.issue_password_reset($1,$2,$3,$4) issued',
      [
        parsed.data.email,
        hash,
        input.clientHash,
        recoveryKey(`email:${parsed.data.email}`),
      ],
    );
    if (rows[0]?.issued) {
      const url = new URL('/reset-password', siteUrl());
      url.hash = `token=${token}`;
      await writeLocalMessage({
        to: parsed.data.email,
        kind: 'reset',
        link: url.toString(),
      });
    }
    return recoveryReply({ success: true, message: recoveryMessage }, 200);
  } catch {
    return recoveryReply(
      { error: 'No pudimos preparar la recuperación. Inténtalo de nuevo.' },
      503,
    );
  } finally {
    await setTimeout(Math.max(0, 300 - (performance.now() - started)));
  }
}

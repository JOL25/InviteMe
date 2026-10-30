import { createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { hashPassword } from '@/lib/passwords';
import { sessionCookie } from '@/lib/auth';
import { recoveryResetSchema } from '@/lib/recovery-rules';
import { recoveryRequest, recoveryReply } from '@/lib/recovery-http';
import {
  localRecoveryEnabled,
  writeLocalMessage,
} from '../../../../../scripts/local-mail.mjs';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  const input = await recoveryRequest(request);
  if ('response' in input) return input.response;
  const parsed = recoveryResetSchema.safeParse(input.body);
  if (!parsed.success)
    return recoveryReply({ error: parsed.error.issues[0].message }, 400);
  try {
    const { rows: attempts } = await query<{ allowed: boolean }>(
      'select private.password_reset_attempt($1) allowed',
      [input.clientHash],
    );
    if (!attempts[0]?.allowed)
      return recoveryReply(
        { error: 'Demasiados intentos. Espera unos minutos.' },
        429,
      );
    const password = await hashPassword(parsed.data.password);
    const hash = createHash('sha256').update(parsed.data.token).digest('hex');
    const { rows } = await query<{ email: string | null }>(
      'select private.consume_password_reset($1,$2) email',
      [hash, password],
    );
    const email = rows[0]?.email;
    if (!email)
      return recoveryReply(
        {
          error:
            'El enlace caducó, ya fue utilizado o fue reemplazado. Solicita uno nuevo.',
        },
        400,
      );
    (await cookies()).delete(sessionCookie);
    if (localRecoveryEnabled())
      await writeLocalMessage({ to: email, kind: 'changed' }).catch(() => {});
    return recoveryReply({ success: true }, 200);
  } catch {
    return recoveryReply(
      {
        error:
          'No pudimos cambiar la contraseña. Intenta iniciar sesión con la nueva antes de solicitar otro enlace.',
      },
      503,
    );
  }
}

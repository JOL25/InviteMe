'use server';
import { createHash } from 'node:crypto';
import { redirect } from 'next/navigation';
import { createSession, destroySession } from '@/lib/auth';
import { query } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/passwords';
import { hasDatabase } from '@/lib/env';
import { authSchema } from '@/lib/validators';
export type AuthState = { error?: string; success?: string };
export async function authenticate(
  mode: 'login' | 'register',
  _state: AuthState,
  form: FormData,
): Promise<AuthState> {
  if (!hasDatabase())
    return { error: 'El servicio de cuentas no está disponible.' };
  const input = authSchema.safeParse({
    email: String(form.get('email') ?? '')
      .trim()
      .toLowerCase(),
    password: String(form.get('password') ?? ''),
  });
  if (!input.success) return { error: input.error.issues[0].message };
  try {
    const key = createHash('sha256').update(input.data.email).digest('hex');
    const { rows: limits } = await query<{ attempts: number }>(
      'select private.auth_attempt($1) attempts',
      [key],
    );
    if (limits[0].attempts > 10)
      return { error: 'Demasiados intentos. Espera unos minutos.' };
    let userId: string;
    let passwordHash: string;
    if (mode === 'register') {
      const hash = await hashPassword(input.data.password);
      passwordHash = hash;
      const { rows } = await query<{ id: string }>(
        'select private.register_user($1,$2) id',
        [input.data.email, hash],
      );
      userId = rows[0].id;
    } else {
      const { rows } = await query<{ id: string; password_hash: string }>(
        'select * from private.login_user($1)',
        [input.data.email],
      );
      const hash =
        rows[0]?.password_hash ??
        `scrypt-v1$${'0'.repeat(32)}$${'0'.repeat(128)}`;
      passwordHash = hash;
      const valid = await verifyPassword(input.data.password, hash);
      if (!valid || !rows[0])
        return { error: 'Correo o contraseña incorrectos.' };
      userId = rows[0].id;
    }
    await createSession(userId, passwordHash);
  } catch {
    return {
      error:
        mode === 'register'
          ? 'No pudimos crear tu cuenta. Si ya tienes una, inicia sesión.'
          : 'No pudimos iniciar sesión. Inténtalo de nuevo.',
    };
  }
  redirect('/dashboard');
}
export async function signOut() {
  await destroySession();
  redirect('/');
}

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
      `insert into auth_limits(key,window_start) values($1,date_bin(interval '10 minutes',now(),timestamptz '2000-01-01'))
       on conflict(key,window_start) do update set attempts=auth_limits.attempts+1 returning attempts`,
      [key],
    );
    if (limits[0].attempts > 10)
      return { error: 'Demasiados intentos. Espera unos minutos.' };
    await query(
      "delete from auth_limits where window_start < now()-interval '1 day'",
    );
    let userId: string;
    if (mode === 'register') {
      const hash = await hashPassword(input.data.password);
      const { rows } = await query<{ id: string }>(
        'insert into app_users(email,password_hash) values($1,$2) returning id',
        [input.data.email, hash],
      );
      userId = rows[0].id;
    } else {
      const { rows } = await query<{ id: string; password_hash: string }>(
        'select id,password_hash from app_users where email=$1',
        [input.data.email],
      );
      const hash =
        rows[0]?.password_hash ??
        `scrypt-v1$${'0'.repeat(32)}$${'0'.repeat(128)}`;
      const valid = await verifyPassword(input.data.password, hash);
      if (!valid || !rows[0])
        return { error: 'Correo o contraseña incorrectos.' };
      userId = rows[0].id;
    }
    await createSession(userId);
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

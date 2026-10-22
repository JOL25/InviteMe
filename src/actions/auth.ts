'use server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { hasSupabase, siteUrl } from '@/lib/env';
import { authSchema } from '@/lib/validators';
export type AuthState = { error?: string; success?: string };
export async function authenticate(
  mode: 'login' | 'register',
  _state: AuthState,
  form: FormData,
): Promise<AuthState> {
  if (!hasSupabase())
    return {
      error: 'Estamos preparando el servicio de cuentas. Inténtalo más tarde.',
    };
  const input = authSchema.safeParse({
    email: String(form.get('email') ?? '').trim(),
    password: String(form.get('password') ?? ''),
  });
  if (!input.success) return { error: input.error.issues[0].message };
  const supabase = await createClient();
  if (mode === 'register') {
    const origin = (await headers()).get('origin');
    const { data, error } = await supabase.auth.signUp({
      ...input.data,
      options: {
        emailRedirectTo: `${origin === siteUrl() ? origin : siteUrl()}/auth/confirm`,
      },
    });
    if (error)
      return {
        error:
          'No pudimos crear tu cuenta. Revisa los datos o inténtalo más tarde.',
      };
    if (!data.session)
      return {
        success:
          'Revisa tu correo para confirmar tu cuenta. Si ya tienes una, inicia sesión.',
      };
  } else {
    const { error } = await supabase.auth.signInWithPassword(input.data);
    if (error)
      return {
        error:
          'No pudimos iniciar sesión. Revisa tu correo, contraseña y confirmación de cuenta.',
      };
  }
  redirect('/dashboard');
}
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}

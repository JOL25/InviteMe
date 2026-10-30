'use client';
import Link from 'next/link';
import { useActionState } from 'react';
import { authenticate, type AuthState } from '@/actions/auth';
import { SubmitButton } from '@/components/submit-button';
export function AuthForm({
  mode,
  configured,
}: {
  mode: 'login' | 'register';
  configured: boolean;
}) {
  const [state, action] = useActionState(
    authenticate.bind(null, mode),
    {} as AuthState,
  );
  const registering = mode === 'register';
  return (
    <form action={action} className="stack">
      {!configured && (
        <p className="notice">
          El servicio de cuentas aún está en preparación. Puedes explorar la
          invitación de ejemplo.
        </p>
      )}
      {state.error && (
        <p role="alert" className="error">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="notice">
          {state.success}
        </p>
      )}
      <label>
        Correo electrónico
        <input
          name="email"
          type="email"
          autoComplete="email"
          placeholder="tu@correo.com"
          required
          maxLength={254}
        />
      </label>
      <label>
        Contraseña
        <input
          name="password"
          type="password"
          autoComplete={registering ? 'new-password' : 'current-password'}
          minLength={10}
          maxLength={128}
          required
          aria-describedby="password-help"
        />
      </label>
      <p id="password-help" className="field-help">
        Usa al menos 10 caracteres.
      </p>
      {!registering && (
        <Link className="text-link" href="/forgot-password">
          Olvidé mi contraseña
        </Link>
      )}
      <SubmitButton
        disabled={!configured}
        pending={registering ? 'Creando tu cuenta…' : 'Entrando…'}
      >
        {registering ? 'Crear mi cuenta' : 'Entrar a mi cuenta'}
      </SubmitButton>
      <p className="text-center muted">
        {registering ? '¿Ya tienes cuenta?' : '¿Es tu primera celebración?'}{' '}
        <Link className="text-link" href={registering ? '/login' : '/register'}>
          {registering ? 'Inicia sesión' : 'Crea tu cuenta'}
        </Link>
      </p>
    </form>
  );
}

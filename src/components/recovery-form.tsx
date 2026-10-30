'use client';
import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';
function subscribe(notify: () => void) {
  window.addEventListener('hashchange', notify);
  return () => window.removeEventListener('hashchange', notify);
}
const subscribeReady = () => () => {};
export function RecoveryForm({
  configured,
  reset = false,
}: {
  configured: boolean;
  reset?: boolean;
}) {
  const hash = useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    () => '',
  );
  const ready = useSyncExternalStore(
    subscribeReady,
    () => true,
    () => false,
  );
  return (
    <RecoveryFields
      key={reset ? hash : 'request'}
      hash={hash}
      configured={configured}
      reset={reset}
      ready={ready}
    />
  );
}
function RecoveryFields({
  hash,
  configured,
  reset,
  ready,
}: {
  hash: string;
  configured: boolean;
  reset: boolean;
  ready: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const token = /^#token=([a-f0-9]{64})$/.exec(hash)?.[1] ?? '';
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || pending || !configured || (reset && !token)) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch(
        `/api/auth/${reset ? 'reset-password' : 'forgot-password'}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            reset
              ? {
                  token,
                  password: form.get('password'),
                  confirmation: form.get('confirmation'),
                }
              : { email: form.get('email') },
          ),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'No pudimos completar la solicitud.');
        return;
      }
      setMessage(
        reset
          ? 'Tu contraseña fue actualizada y las sesiones anteriores se cerraron. Inicia sesión con tu nueva contraseña.'
          : data.message,
      );
    } catch {
      setError('No pudimos conectar. Inténtalo de nuevo.');
    } finally {
      setPending(false);
    }
  }
  if (reset && message)
    return (
      <div className="stack">
        <p className="notice" role="status">
          {message}
        </p>
        <Link className="button" href="/login">
          Iniciar sesión
        </Link>
      </div>
    );
  return (
    <form onSubmit={submit} className="stack recovery-form">
      <noscript>
        <p className="notice">Activa JavaScript para recuperar tu cuenta.</p>
      </noscript>
      {!configured && (
        <p className="notice">
          La recuperación aún no está disponible en este sitio.
        </p>
      )}
      {reset && !token && (
        <p className="notice">
          Abre el enlace completo de recuperación para elegir una nueva
          contraseña.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {reset ? (
        <>
          <label>
            Nueva contraseña
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
              maxLength={128}
            />
          </label>
          <label>
            Repetir nueva contraseña
            <input
              name="confirmation"
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
              maxLength={128}
            />
          </label>
          <p className="field-help">
            Usa al menos 10 caracteres. El enlace funciona una sola vez.
          </p>
        </>
      ) : (
        <label>
          Correo electrónico
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
          />
        </label>
      )}
      <button
        className="button"
        disabled={!ready || pending || !configured || (reset && !token)}
      >
        {pending
          ? 'Procesando…'
          : reset
            ? 'Guardar nueva contraseña'
            : 'Solicitar recuperación'}
      </button>
      <Link className="text-link" href={reset ? '/forgot-password' : '/login'}>
        {reset ? 'Solicitar un nuevo enlace' : '← Volver a iniciar sesión'}
      </Link>
    </form>
  );
}

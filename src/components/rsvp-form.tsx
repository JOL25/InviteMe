'use client';
import { useState, useRef, useEffect, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: {
          sitekey: string;
          action: string;
          callback: (token: string) => void;
          'expired-callback': () => void;
          'error-callback': () => void;
        },
      ) => string;
      reset: (id: string) => void;
      remove: (id: string) => void;
    };
  }
}
type Props = { slug: string; sample?: boolean; preview?: boolean };
type GuestInvitation = {
  id: string;
  name: string;
  max_party_size: number;
  attendance: boolean | null;
  party_size: number | null;
};
function fragmentToken() {
  return window.location.hash.startsWith('#invitado=')
    ? window.location.hash.slice('#invitado='.length)
    : null;
}
function subscribeFragment(notify: () => void) {
  window.addEventListener('hashchange', notify);
  return () => window.removeEventListener('hashchange', notify);
}
const subscribeReady = () => () => {};
export function RSVPForm(props: Props) {
  const inviteToken = useSyncExternalStore(
    subscribeFragment,
    fragmentToken,
    () => null,
  );
  const ready = useSyncExternalStore(
    subscribeReady,
    () => true,
    () => false,
  );
  return (
    <RSVPFields
      key={`${props.slug}:${inviteToken ?? 'open'}`}
      {...props}
      inviteToken={inviteToken}
      ready={ready}
    />
  );
}
function RSVPFields({
  slug,
  sample = false,
  preview = false,
  inviteToken,
  ready,
}: Props & { inviteToken: string | null; ready: boolean }) {
  const [invitation, setInvitation] = useState<GuestInvitation | null>(null);
  const [invitationError, setInvitationError] = useState('');
  useEffect(() => {
    if (inviteToken === null || sample || preview) return;
    const controller = new AbortController();
    fetch('/api/invitations/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, token: inviteToken }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || 'El enlace no está disponible.');
        return data as GuestInvitation;
      })
      .then(setInvitation)
      .catch((error) => {
        if (!controller.signal.aborted)
          setInvitationError(
            error instanceof Error
              ? error.message
              : 'No pudimos comprobar tu invitación.',
          );
      });
    return () => controller.abort();
  }, [slug, inviteToken, sample, preview]);
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [attendance, setAttendance] = useState('yes');
  const [token, setToken] = useState('');
  const [loaded, setLoaded] = useState(false);
  const key = useRef<string | null>(null);
  const captcha = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  useEffect(() => {
    if (
      !loaded ||
      !sitekey ||
      !captcha.current ||
      !window.turnstile ||
      sample ||
      preview
    )
      return;
    widget.current = window.turnstile.render(captcha.current, {
      sitekey,
      action: 'rsvp',
      callback: setToken,
      'expired-callback': () => setToken(''),
      'error-callback': () => setToken(''),
    });
    return () => {
      if (widget.current) window.turnstile?.remove(widget.current);
    };
  }, [loaded, sitekey, sample, preview]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      sample ||
      preview ||
      pending ||
      !ready ||
      fragmentToken() !== inviteToken ||
      (inviteToken !== null && !invitation)
    )
      return;
    setPending(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const storageKey = invitation
      ? `inviteme-key:${slug}:guest:${invitation.id}`
      : `inviteme-key:${slug}`;
    try {
      if (!key.current) {
        try {
          key.current = sessionStorage.getItem(storageKey);
        } catch {
          /* Storage may be disabled. */
        }
        key.current ||= crypto.randomUUID();
        try {
          sessionStorage.setItem(storageKey, key.current);
        } catch {
          /* In-memory retries still work. */
        }
      }
      const response = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          inviteToken: inviteToken ?? undefined,
          guestName: form.get('guestName'),
          guestEmail: form.get('guestEmail'),
          attendance: attendance === 'yes',
          partySize: attendance === 'yes' ? Number(form.get('partySize')) : 1,
          note: form.get('note'),
          website: form.get('website'),
          idempotencyKey: key.current,
          turnstileToken: token,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'No pudimos guardar tu respuesta.');
        return;
      }
      try {
        sessionStorage.setItem(
          `inviteme-receipt:${slug}`,
          JSON.stringify({
            attendance: attendance === 'yes',
            size: attendance === 'yes' ? Number(form.get('partySize')) : 0,
          }),
        );
      } catch {
        /* Confirmation page has a generic fallback. */
      }
      router.push(`/i/${slug}/thanks?confirmed=1`);
    } catch {
      setError(
        'No pudimos conectar. Reintenta sin cerrar esta página; evitaremos duplicar tu respuesta.',
      );
    } finally {
      setPending(false);
      if (widget.current) {
        window.turnstile?.reset(widget.current);
        setToken('');
      }
    }
  }
  if (inviteToken !== null && !sample && !preview) {
    if (invitationError)
      return (
        <p className="error" role="alert">
          {invitationError}
        </p>
      );
    if (!invitation)
      return (
        <p className="notice" role="status">
          Comprobando tu invitación individual…
        </p>
      );
    if (invitation.attendance !== null)
      return (
        <div className="notice" role="status">
          <strong>{invitation.name}, ya recibimos tu respuesta.</strong>
          <p>
            {invitation.attendance
              ? `Confirmaste para ${invitation.party_size} ${invitation.party_size === 1 ? 'persona' : 'personas'}.`
              : 'Nos avisaste que no podrás asistir.'}{' '}
            Para solicitar cambios, contacta con quien organiza el evento.
          </p>
        </div>
      );
  }
  return (
    <form onSubmit={submit} className="rsvp-form stack">
      <noscript>
        <p className="notice">Activa JavaScript para enviar tu respuesta.</p>
      </noscript>
      {invitation && (
        <p className="notice">
          Esta invitación es para <strong>{invitation.name}</strong>. Puedes
          confirmar hasta {invitation.max_party_size}{' '}
          {invitation.max_party_size === 1 ? 'persona' : 'personas'},
          incluyéndote.
        </p>
      )}
      {(sample || preview) && (
        <p className="notice">
          {sample
            ? 'Esta es una invitación de ejemplo. Las respuestas no se envían.'
            : 'Vista previa privada. Las respuestas no se envían desde aquí.'}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <label>
        Tu nombre
        <input
          name="guestName"
          defaultValue={invitation?.name ?? ''}
          readOnly={Boolean(invitation)}
          required
          minLength={2}
          maxLength={120}
          autoComplete="name"
          placeholder="Nombre y apellido"
        />
      </label>
      <label>
        Correo electrónico <span className="optional">(opcional)</span>
        <input
          name="guestEmail"
          type="email"
          maxLength={254}
          autoComplete="email"
          placeholder="tu@correo.com"
        />
      </label>
      <fieldset>
        <legend>¿Nos acompañas?</legend>
        <div className="attendance-options">
          <label className={attendance === 'yes' ? 'selected' : ''}>
            <input
              type="radio"
              name="attendance"
              value="yes"
              checked={attendance === 'yes'}
              onChange={() => setAttendance('yes')}
            />
            Sí, ¡ahí estaré!
          </label>
          <label className={attendance === 'no' ? 'selected' : ''}>
            <input
              type="radio"
              name="attendance"
              value="no"
              checked={attendance === 'no'}
              onChange={() => setAttendance('no')}
            />
            No podré asistir
          </label>
        </div>
      </fieldset>
      {attendance === 'yes' && (
        <label>
          Personas que asistirán, incluyéndote
          <select name="partySize" defaultValue="1">
            {Array.from(
              { length: invitation?.max_party_size ?? 10 },
              (_, i) => (
                <option key={i} value={i + 1}>
                  {i + 1} {i === 0 ? 'persona' : 'personas'}
                </option>
              ),
            )}
          </select>
        </label>
      )}
      <label>
        Un mensaje para los anfitriones{' '}
        <span className="optional">(opcional)</span>
        <textarea
          name="note"
          maxLength={500}
          rows={3}
          placeholder="¿Algo que debamos saber?"
        />
      </label>
      <div className="honeypot" aria-hidden="true">
        <label>
          Website
          <input
            name="website"
            tabIndex={-1}
            autoComplete="off"
            defaultValue=""
          />
        </label>
      </div>
      {sitekey && !sample && !preview && (
        <>
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
            onReady={() => setLoaded(true)}
          />
          <div ref={captcha} />
        </>
      )}
      <button
        type="submit"
        className="button"
        disabled={
          !ready || pending || sample || preview || Boolean(sitekey && !token)
        }
      >
        {pending
          ? 'Enviando respuesta…'
          : sample || preview
            ? 'Confirmar asistencia · vista previa'
            : 'Enviar mi respuesta'}
      </button>
      <p className="field-help text-center">
        Tu respuesta solo será visible para quien organiza el evento.
      </p>
    </form>
  );
}

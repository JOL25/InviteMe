'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { managementFragment, type ManagedReply } from '@/lib/rsvp-management';
import { RSVPVerification } from '@/components/rsvp-verification';
function subscribe(notify: () => void) {
  window.addEventListener('hashchange', notify);
  return () => window.removeEventListener('hashchange', notify);
}
export function RSVPManager({ slug }: { slug: string }) {
  const hash = useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    () => '',
  );
  const [reload, setReload] = useState(0);
  const [message, setMessage] = useState('');
  const capability = managementFragment(hash);
  return (
    <div className="stack rsvp-management">
      <noscript>
        <p className="notice">Activa JavaScript para gestionar tu respuesta.</p>
      </noscript>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {capability ? (
        <ReplyForm
          key={`${hash}:${reload}`}
          slug={slug}
          kind={capability.kind}
          token={capability.token}
          onSaved={(intent) => {
            setMessage(
              intent === 'cancel'
                ? 'Tu asistencia quedó cancelada y se liberaron los cupos.'
                : 'Tu respuesta fue actualizada.',
            );
            setReload((value) => value + 1);
          }}
        />
      ) : (
        <p className="notice">
          Abre el enlace privado de gestión que recibiste al responder, o vuelve
          a tu invitación individual.
        </p>
      )}
      {capability && (
        <button
          type="button"
          className="text-button"
          onClick={() => {
            setMessage('');
            setReload((value) => value + 1);
          }}
        >
          Recargar datos
        </button>
      )}
      <a
        className="text-link"
        href={`/i/${slug}${capability?.kind === 'guest' ? `#invitado=${capability.token}` : ''}`}
      >
        ← Volver a la invitación
      </a>
    </div>
  );
}
function ReplyForm({
  slug,
  kind,
  token,
  onSaved,
}: {
  slug: string;
  kind: 'guest' | 'open';
  token: string;
  onSaved: (intent: string) => void;
}) {
  const [reply, setReply] = useState<ManagedReply | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [attendance, setAttendance] = useState('yes');
  const [captchaToken, setCaptchaToken] = useState('');
  const [challenge, setChallenge] = useState(0);
  const [copied, setCopied] = useState('');
  const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/rsvp/manage/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, kind, token }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || 'El enlace no está disponible.');
        return data as ManagedReply;
      })
      .then((data) => {
        setReply(data);
        setAttendance(data.attendance ? 'yes' : 'no');
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setError(
            failure instanceof Error
              ? failure.message
              : 'No pudimos consultar tu respuesta.',
          );
      });
    return () => controller.abort();
  }, [slug, kind, token]);
  async function save(intent: 'update' | 'cancel', form?: FormData) {
    if (!reply || pending || Boolean(sitekey && !captchaToken)) return;
    if (
      intent === 'cancel' &&
      !window.confirm(
        '¿Cancelar tu asistencia y liberar todos los cupos de tu respuesta?',
      )
    )
      return;
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/rsvp/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          kind,
          token,
          revision: reply.revision,
          intent,
          guestName:
            intent === 'cancel' ? reply.guest_name : form?.get('guestName'),
          guestEmail:
            intent === 'cancel' ? reply.guest_email : form?.get('guestEmail'),
          attendance: intent === 'cancel' ? false : attendance === 'yes',
          partySize:
            intent === 'update' && attendance === 'yes'
              ? Number(form?.get('partySize'))
              : 1,
          note: intent === 'cancel' ? reply.note : form?.get('note'),
          website: '',
          turnstileToken: captchaToken,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'No pudimos guardar el cambio.');
        return;
      }
      onSaved(intent);
    } catch {
      setError(
        'No pudimos conectar. Recarga los datos para comprobar si el cambio quedó guardado.',
      );
    } finally {
      setPending(false);
      setCaptchaToken('');
      setChallenge((value) => value + 1);
    }
  }
  if (!reply)
    return error ? (
      <p className="error" role="alert">
        {error}
      </p>
    ) : (
      <p role="status" className="notice">
        Comprobando tu respuesta…
      </p>
    );
  const disabled = pending || Boolean(sitekey && !captchaToken);
  return (
    <section className="panel stack" aria-label="Gestionar mi respuesta">
      <div className="notice">
        <strong>{reply.guest_name}</strong>
        <p>
          {reply.cancelled
            ? 'Tu asistencia está cancelada.'
            : reply.attendance
              ? `Confirmaste para ${reply.party_size} ${reply.party_size === 1 ? 'persona' : 'personas'}.`
              : 'Nos avisaste que no podrás asistir.'}
        </p>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!reply.rsvp_open && (
        <p className="notice">
          Las confirmaciones están cerradas. Aún puedes cancelar tu asistencia.
        </p>
      )}
      {reply.rsvp_open && (
        <form
          className="stack rsvp-edit-form"
          onSubmit={(event) => {
            event.preventDefault();
            void save('update', new FormData(event.currentTarget));
          }}
        >
          <label>
            Tu nombre
            <input
              name="guestName"
              required
              minLength={2}
              maxLength={120}
              defaultValue={reply.guest_name}
              readOnly={kind === 'guest'}
            />
          </label>
          <label>
            Correo electrónico <span className="optional">(opcional)</span>
            <input
              name="guestEmail"
              type="email"
              maxLength={254}
              defaultValue={reply.guest_email}
            />
          </label>
          <label>
            Asistencia
            <select
              value={attendance}
              onChange={(event) => setAttendance(event.target.value)}
            >
              <option value="yes">Sí asistiré</option>
              <option value="no">No podré asistir</option>
            </select>
          </label>
          {attendance === 'yes' && (
            <label>
              Personas que asistirán, incluyéndote
              <select
                name="partySize"
                defaultValue={reply.attendance ? reply.party_size : 1}
              >
                {Array.from({ length: reply.max_party_size }, (_, i) => (
                  <option value={i + 1} key={i}>
                    {i + 1} {i ? 'personas' : 'persona'}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Mensaje para los anfitriones{' '}
            <span className="optional">(opcional)</span>
            <textarea
              name="note"
              maxLength={500}
              rows={3}
              defaultValue={reply.note}
            />
          </label>
          <button className="button" disabled={disabled}>
            {pending ? 'Guardando…' : 'Guardar cambios de mi respuesta'}
          </button>
        </form>
      )}
      <RSVPVerification key={challenge} onToken={setCaptchaToken} />
      {reply.attendance && !reply.cancelled && (
        <button
          className="text-button danger"
          type="button"
          disabled={disabled}
          onClick={() => void save('cancel')}
        >
          Cancelar mi asistencia
        </button>
      )}
      <p className="field-help">
        Cancelar conserva tu respuesta y libera tus cupos; no te devuelve a la
        lista de pendientes. Podrás volver a confirmar si hay cupo y las
        confirmaciones están abiertas.
      </p>
      <button
        className="button button-outline"
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied('Enlace privado copiado. Guárdalo y no lo compartas.');
          } catch {
            setCopied(
              'Copia la dirección de esta página para conservar tu enlace.',
            );
          }
        }}
      >
        Copiar mi enlace privado de gestión
      </button>
      {copied && (
        <p role="status" className="field-help">
          {copied}
        </p>
      )}
    </section>
  );
}

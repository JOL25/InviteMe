'use client';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  saveInvitee,
  changeInviteeLink,
  type InviteState,
} from '@/actions/invitees';
import type { InvitedGuest } from '@/lib/invitees';
import { SubmitButton } from '@/components/submit-button';

function Feedback({ state }: { state: InviteState }) {
  return (
    <>
      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="field-help" role="status">
          {state.success}
        </p>
      )}
    </>
  );
}
function Fields({ guest }: { guest?: InvitedGuest }) {
  const locked = guest?.attendance !== null && guest?.attendance !== undefined;
  return (
    <>
      <label>
        Nombre del invitado
        <input
          name="name"
          defaultValue={guest?.name ?? ''}
          required
          minLength={2}
          maxLength={120}
          readOnly={locked}
        />
      </label>
      <label>
        Correo de contacto <span className="optional">(opcional)</span>
        <input
          name="email"
          type="email"
          maxLength={254}
          defaultValue={guest?.email ?? ''}
          readOnly={locked}
        />
      </label>
      <label>
        Cupo de esta invitación, incluyendo al invitado
        <select
          name="max_party_size"
          defaultValue={guest?.max_party_size ?? 1}
          disabled={locked}
        >
          {Array.from({ length: 10 }, (_, i) => (
            <option key={i} value={i + 1}>
              {i + 1} {i === 0 ? 'persona' : 'personas'}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
export function AddInvitee({ eventId }: { eventId: string }) {
  const [state, action] = useActionState(saveInvitee, {} as InviteState);
  return (
    <form action={action} className="panel stack add-invitee">
      <input type="hidden" name="eventId" value={eventId} />
      <div>
        <span className="eyebrow">CADA PERSONA, SU INVITACIÓN</span>
        <h2>Añadir a la lista.</h2>
        <p className="field-help">
          Una invitación puede incluir acompañantes. Los cupos se ocupan al
          confirmar asistencia.
        </p>
      </div>
      <Fields />
      <SubmitButton pending="Añadiendo invitado…">Añadir invitado</SubmitButton>
      <Feedback state={state} />
    </form>
  );
}
function LinkControls({ guest }: { guest: InvitedGuest }) {
  const { pending } = useFormStatus();
  return (
    <div className="invitee-controls">
      <button
        className="button button-outline"
        type="submit"
        name="intent"
        value="renew"
        disabled={pending}
      >
        Renovar enlace
      </button>
      <button
        className="text-button"
        type="submit"
        name="intent"
        value="revoke"
        disabled={pending || guest.revoked}
      >
        Desactivar enlace
      </button>
      {guest.attendance === null && (
        <button
          className="text-button danger"
          type="submit"
          name="intent"
          value="delete"
          disabled={pending}
        >
          Eliminar invitado
        </button>
      )}
    </div>
  );
}
export function InviteeCard({
  eventId,
  guest,
}: {
  eventId: string;
  guest: InvitedGuest;
}) {
  const [state, action] = useActionState(saveInvitee, {} as InviteState);
  const [linkState, linkAction] = useActionState(
    changeInviteeLink,
    {} as InviteState,
  );
  const [copyMessage, setCopyMessage] = useState('');
  return (
    <article
      className="panel stack invitee-card"
      aria-label={`Invitación de ${guest.name}`}
    >
      <div className="invitee-heading">
        <h3>{guest.name}</h3>
        <span
          className={`badge ${guest.attendance === true ? 'badge-live' : ''}`}
        >
          {guest.attendance === null
            ? 'Pendiente'
            : guest.attendance
              ? 'Confirmó asistencia'
              : 'No asistirá'}
        </span>
      </div>
      {guest.attendance === null ? (
        <form action={action} className="stack-sm">
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="guestId" value={guest.id} />
          <Fields guest={guest} />
          <SubmitButton className="button button-outline">
            Guardar invitado
          </SubmitButton>
          <Feedback state={state} />
        </form>
      ) : (
        <p className="field-help">
          {guest.attendance
            ? `Confirmó para ${guest.party_size} ${guest.party_size === 1 ? 'persona' : 'personas'}.`
            : 'Gracias por avisar que no podrá asistir.'}{' '}
          Los datos de la invitación con respuesta se conservan.
          {guest.email && <span> Contacto: {guest.email}.</span>}
        </p>
      )}
      {guest.url ? (
        <div className="stack-sm invitee-link">
          <label>
            Enlace individual de {guest.name}
            <input
              value={guest.url}
              readOnly
              onFocus={(event) => event.currentTarget.select()}
            />
          </label>
          <div className="invitee-controls">
            <button
              className="button"
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(guest.url!);
                  setCopyMessage('Enlace individual copiado.');
                } catch {
                  setCopyMessage('Selecciona el enlace y cópialo manualmente.');
                }
              }}
            >
              Copiar enlace individual
            </button>
            <a
              className="text-link"
              href={guest.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir invitación individual ↗
            </a>
          </div>
          {copyMessage && (
            <p className="field-help" role="status">
              {copyMessage}
            </p>
          )}
        </div>
      ) : (
        <p className="notice">
          {guest.revoked
            ? 'El enlace está desactivado.'
            : 'El enlace necesita renovarse antes de compartirlo.'}
        </p>
      )}
      <form
        action={linkAction}
        className="stack-sm"
        onSubmit={(event) => {
          const intent = (
            (event.nativeEvent as SubmitEvent)
              .submitter as HTMLButtonElement | null
          )?.value;
          const message =
            intent === 'delete'
              ? '¿Eliminar a este invitado pendiente y cancelar su enlace?'
              : intent === 'renew'
                ? '¿Renovar el enlace? El anterior dejará de funcionar; la respuesta registrada se conserva.'
                : intent === 'revoke'
                  ? '¿Desactivar este enlace? La respuesta y el invitado se conservan.'
                  : null;
          if (message && !window.confirm(message)) event.preventDefault();
        }}
      >
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="guestId" value={guest.id} />
        <LinkControls guest={guest} />
        <Feedback state={linkState} />
      </form>
    </article>
  );
}

'use client';
import { useActionState } from 'react';
import {
  changePublication,
  deleteEvent,
  type EventState,
} from '@/actions/events';
import { SubmitButton } from '@/components/submit-button';
export function PublishButton({
  id,
  published,
}: {
  id: string;
  published: boolean;
}) {
  const [state, action] = useActionState(changePublication, {} as EventState);
  return (
    <form action={action} className="stack-sm">
      <input type="hidden" name="id" value={id} />
      <input
        type="hidden"
        name="intent"
        value={published ? 'unpublish' : 'publish'}
      />
      <SubmitButton className={published ? 'button button-outline' : 'button'}>
        {published ? 'Volver a borrador' : 'Publicar invitación ↗'}
      </SubmitButton>
      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="field-help">
          {state.success}
        </p>
      )}
    </form>
  );
}
export function DeleteButton({ id }: { id: string }) {
  const [state, action] = useActionState(deleteEvent, {} as EventState);
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (
          !window.confirm(
            '¿Eliminar el evento y todas sus respuestas? Esta acción no se puede deshacer.',
          )
        )
          event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <SubmitButton className="text-button danger" pending="Eliminando…">
        Eliminar evento
      </SubmitButton>
      {state.error && (
        <p role="alert" className="error">
          {state.error}
        </p>
      )}
    </form>
  );
}

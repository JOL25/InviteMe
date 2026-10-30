'use client';
import { useActionState } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import {
  updateItinerary,
  removeActivity,
  type ItineraryState,
} from '@/actions/itinerary';
import { SubmitButton } from '@/components/submit-button';
import { maxActivities } from '@/lib/itinerary-rules';
import type { Activity } from '@/types/database';
function Feedback({ state }: { state: ItineraryState }) {
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
function ActivityForm({
  eventId,
  timezone,
  startsAt,
  activity,
}: {
  eventId: string;
  timezone: string;
  startsAt: string;
  activity?: Activity;
}) {
  const [state, action] = useActionState(updateItinerary, {} as ItineraryState);
  const [removeState, removeAction] = useActionState(
    removeActivity,
    {} as ItineraryState,
  );
  return (
    <article
      className={`panel stack ${activity ? 'activity-edit-card' : 'activity-add'}`}
      aria-label={activity ? `Actividad: ${activity.title}` : 'Nueva actividad'}
    >
      <form action={action} className="stack-sm">
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="activityId" value={activity?.id ?? ''} />
        <label>
          Título de la actividad
          <input
            name="title"
            required
            minLength={2}
            maxLength={120}
            defaultValue={activity?.title ?? ''}
            placeholder="Ceremonia, cena, baile…"
          />
        </label>
        <label>
          Fecha y hora de la actividad
          <input
            name="localDate"
            type="datetime-local"
            required
            defaultValue={formatInTimeZone(
              activity?.starts_at ?? startsAt,
              timezone,
              "yyyy-MM-dd'T'HH:mm",
            )}
          />
        </label>
        <label>
          Lugar de la actividad <span className="optional">(opcional)</span>
          <input
            name="venue_name"
            maxLength={160}
            defaultValue={activity?.venue_name ?? ''}
          />
        </label>
        <label>
          Descripción de la actividad{' '}
          <span className="optional">(opcional)</span>
          <textarea
            name="description"
            rows={3}
            maxLength={500}
            defaultValue={activity?.description ?? ''}
          />
        </label>
        <SubmitButton pending="Guardando actividad…">
          {activity ? 'Guardar actividad' : 'Añadir actividad'}
        </SubmitButton>
        <Feedback state={state} />
      </form>
      {activity && (
        <form
          action={removeAction}
          onSubmit={(event) => {
            if (!window.confirm(`¿Eliminar la actividad «${activity.title}»?`))
              event.preventDefault();
          }}
        >
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="activityId" value={activity.id} />
          <SubmitButton className="text-button danger" pending="Eliminando…">
            Eliminar actividad
          </SubmitButton>
          <Feedback state={removeState} />
        </form>
      )}
    </article>
  );
}
export function ItineraryManager({
  eventId,
  timezone,
  startsAt,
  activities,
}: {
  eventId: string;
  timezone: string;
  startsAt: string;
  activities: Activity[];
}) {
  return (
    <section
      className="itinerary-manager stack"
      id="itinerary"
      aria-labelledby="itinerary-heading"
    >
      <div>
        <span className="eyebrow">CADA MOMENTO, SU LUGAR</span>
        <h2 id="itinerary-heading">Tu itinerario.</h2>
        <p className="field-help">
          {activities.length} de {maxActivities} actividades. Se ordenan
          automáticamente por fecha y hora, en la zona {timezone}. Puedes
          incluir actividades de varios días.
        </p>
      </div>
      {activities.length < maxActivities ? (
        <ActivityForm
          eventId={eventId}
          timezone={timezone}
          startsAt={startsAt}
        />
      ) : (
        <p className="notice">
          Has llegado al límite de 20 actividades. Puedes editar o eliminar las
          existentes.
        </p>
      )}
      {activities.length ? (
        <div className="activity-editor-list">
          {activities.map((activity) => (
            <ActivityForm
              key={`${activity.id}:${activity.starts_at}:${timezone}`}
              eventId={eventId}
              timezone={timezone}
              startsAt={startsAt}
              activity={activity}
            />
          ))}
        </div>
      ) : (
        <p className="field-help">
          Añade tu primera actividad. Si no hay actividades, esta sección no
          aparece en la invitación.
        </p>
      )}
    </section>
  );
}

'use client';
import { useActionState } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { saveEvent, type EventState } from '@/actions/events';
import { categoryLabels } from '@/lib/validators';
import { SubmitButton } from '@/components/submit-button';
import type { Event } from '@/types/database';
export function EventForm({ event }: { event?: Event }) {
  const [state, action] = useActionState(saveEvent, {} as EventState);
  const v = (name: string, fallback: string = '') =>
    state.values?.[name] ?? fallback;
  return (
    <form action={action} className="event-form stack">
      {event && <input type="hidden" name="id" value={event.id} />}
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
      <section className="panel stack">
        <div>
          <span className="eyebrow">01 / LOS DETALLES</span>
          <h2>¿Qué vamos a celebrar?</h2>
        </div>
        <label>
          Título del evento
          <input
            name="title"
            defaultValue={v('title', event?.title)}
            placeholder="La boda de Valentina & Mateo"
            minLength={3}
            maxLength={120}
            required
          />
        </label>
        <div className="form-grid">
          <label>
            Tipo de celebración
            <select
              name="category"
              defaultValue={v('category', event?.category || 'wedding')}
            >
              {Object.entries(categoryLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Cupo total <span className="optional">(opcional)</span>
            <input
              name="capacity"
              type="number"
              min="1"
              max="100000"
              defaultValue={v('capacity', event?.capacity?.toString())}
              placeholder="Sin límite"
            />
          </label>
        </div>
        <div className="form-grid">
          <label>
            Fecha y hora local
            <input
              name="localDate"
              type="datetime-local"
              required
              defaultValue={v(
                'localDate',
                event
                  ? formatInTimeZone(
                      event.starts_at,
                      event.timezone,
                      "yyyy-MM-dd'T'HH:mm",
                    )
                  : '',
              )}
            />
          </label>
          <label>
            Zona horaria
            <input
              name="timezone"
              defaultValue={v('timezone', event?.timezone || 'America/Lima')}
              list="timezones"
              required
            />
            <datalist id="timezones">
              {[
                'America/Lima',
                'America/Bogota',
                'America/Mexico_City',
                'America/Santiago',
                'America/Argentina/Buenos_Aires',
                'America/New_York',
                'Europe/Madrid',
              ].map((zone) => (
                <option key={zone} value={zone} />
              ))}
            </datalist>
          </label>
        </div>
        <label>
          Lugar
          <input
            name="venue_name"
            required
            minLength={2}
            maxLength={160}
            defaultValue={v('venue_name', event?.venue_name)}
            placeholder="Jardín de los Olivos"
          />
        </label>
        <label>
          Dirección <span className="optional">(opcional)</span>
          <input
            name="venue_address"
            maxLength={300}
            defaultValue={v('venue_address', event?.venue_address)}
          />
        </label>
        <label>
          Enlace del mapa <span className="optional">(opcional)</span>
          <input
            name="map_url"
            type="url"
            maxLength={2000}
            defaultValue={v('map_url', event?.map_url)}
            placeholder="https://maps.google.com/…"
          />
        </label>
      </section>
      <section className="panel stack">
        <div>
          <span className="eyebrow">02 / A TU ESTILO</span>
          <h2>Hazla tuya.</h2>
        </div>
        <div className="theme-option">
          <span className="theme-swatch" aria-hidden="true">
            Aa
          </span>
          <div>
            <strong>Clásica</strong>
            <p className="field-help">
              Editorial, delicada y pensada para tus mejores momentos.
            </p>
          </div>
          <span className="badge">Seleccionada</span>
        </div>
        <label>
          Mensaje para tus invitados
          <textarea
            name="message"
            rows={5}
            minLength={3}
            maxLength={3000}
            required
            defaultValue={v(
              'message',
              event?.message ||
                'Nos encantaría compartir este día contigo. Ven a celebrar, a reír y a crear recuerdos que duren para siempre.',
            )}
          />
        </label>
        <div className="form-grid">
          <label>
            Color principal
            <input
              type="color"
              name="primary_color"
              defaultValue={v(
                'primary_color',
                event?.primary_color || '#18233B',
              )}
            />
          </label>
          <label>
            Color de acento
            <input
              type="color"
              name="accent_color"
              defaultValue={v('accent_color', event?.accent_color || '#D49D9D')}
            />
          </label>
        </div>
        <label className="checkbox-label">
          <input
            name="rsvp_open"
            type="checkbox"
            defaultChecked={
              state.values
                ? state.values.rsvp_open === 'on'
                : (event?.rsvp_open ?? true)
            }
          />
          Aceptar confirmaciones de asistencia
        </label>
        <p className="field-help">
          Puedes cerrar las confirmaciones y mantener visible la invitación.
        </p>
      </section>
      <div className="form-save">
        <p className="field-help">
          {event
            ? 'Los cambios se aplican a tu invitación al guardar.'
            : 'Se guardará como borrador. Tú decides cuándo publicarla.'}
        </p>
        <SubmitButton>
          {event ? 'Guardar cambios' : 'Crear mi invitación'}
        </SubmitButton>
      </div>
    </form>
  );
}

import { formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';
import type { Activity } from '@/types/database';
export function EventItinerary({
  activities,
  timezone,
}: {
  activities: Activity[];
  timezone: string;
}) {
  if (!activities.length) return null;
  return (
    <section
      className="event-itinerary"
      aria-labelledby="public-itinerary-heading"
    >
      <div data-reveal>
        <span className="eyebrow">MOMENTOS PARA COMPARTIR</span>
        <h2 id="public-itinerary-heading">Así celebraremos.</h2>
        <p className="muted">Horarios en {timezone}</p>
      </div>
      <ol className="itinerary-timeline">
        {activities.map((activity) => (
          <li key={activity.id} data-reveal>
            <time dateTime={activity.starts_at}>
              <span>
                {formatInTimeZone(
                  activity.starts_at,
                  timezone,
                  "d 'de' MMMM · yyyy",
                  { locale: es },
                )}
              </span>
              <strong>
                {formatInTimeZone(activity.starts_at, timezone, 'HH:mm')} h
              </strong>
            </time>
            <div>
              <h3>{activity.title}</h3>
              {activity.venue_name && (
                <p className="itinerary-venue">{activity.venue_name}</p>
              )}
              {activity.description && (
                <p className="itinerary-description">{activity.description}</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

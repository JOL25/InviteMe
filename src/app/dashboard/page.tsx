import Link from 'next/link';
import { Plus, ArrowUpRight, CalendarDays } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';
import { listOwnedEvents } from '@/lib/event-store';
import { requireUser } from '@/lib/auth';
import { categoryLabels } from '@/lib/validators';
export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q = '', page: rawPage } = await searchParams;
  const page = Math.max(1, Math.min(10000, Math.floor(Number(rawPage) || 1)));
  const { user } = await requireUser();
  const search = q.slice(0, 100).replace(/[%_\\]/g, '');
  const { data, count } = await listOwnedEvents(user.id, search, page);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">TU ESPACIO PARA CELEBRAR</span>
          <h1>
            Mis eventos<span className="rose-dot">.</span>
          </h1>
          <p className="muted">
            Grandes momentos. Todos los detalles, en un solo lugar.
          </p>
        </div>
        <Link className="button" href="/dashboard/events/new">
          <Plus size={18} />
          Crear invitación
        </Link>
      </div>
      <form className="search-form" action="/dashboard">
        <label className="sr-only" htmlFor="search-events">
          Buscar eventos
        </label>
        <input
          id="search-events"
          name="q"
          placeholder="Buscar una celebración…"
          defaultValue={q}
          maxLength={100}
        />
        <button className="button button-outline">Buscar</button>
      </form>
      {!data?.length ? (
        <section className="empty-state panel">
          <CalendarDays size={40} strokeWidth={1} />
          <h2>
            {search
              ? 'No encontramos esa celebración.'
              : 'Tu próximo recuerdo empieza aquí.'}
          </h2>
          <p className="muted">
            {search
              ? 'Prueba con otro título.'
              : 'Crea tu primera invitación y compártela con quienes más quieres.'}
          </p>
          <Link
            className="button"
            href={search ? '/dashboard' : '/dashboard/events/new'}
          >
            {search ? 'Ver todos los eventos' : 'Crear mi primera invitación'}
          </Link>
        </section>
      ) : (
        <div className="events-grid">
          {data.map((event) => (
            <article className="event-card" key={event.id}>
              <div
                className="event-card-art"
                style={{ background: event.accent_color }}
              >
                <span aria-hidden="true">✳</span>
                <span
                  className={`badge ${event.published_at ? 'badge-live' : ''}`}
                >
                  {event.published_at ? 'Publicada' : 'Borrador'}
                </span>
              </div>
              <div className="event-card-body">
                <span className="eyebrow">
                  {categoryLabels[event.category]}
                </span>
                <h2>
                  <Link href={`/dashboard/events/${event.id}/edit`}>
                    {event.title}
                  </Link>
                </h2>
                <p className="muted">
                  {formatInTimeZone(
                    event.starts_at,
                    event.timezone,
                    'd MMM yyyy · HH:mm',
                    { locale: es },
                  )}
                </p>
                <div className="event-card-footer">
                  <Link
                    className="text-link"
                    href={`/dashboard/events/${event.id}/guests`}
                  >
                    Ver respuestas
                  </Link>
                  <Link
                    className="icon-link"
                    aria-label={`Editar ${event.title}`}
                    href={`/dashboard/events/${event.id}/edit`}
                  >
                    <ArrowUpRight size={21} />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      <nav className="pagination" aria-label="Paginación">
        {page > 1 && (
          <Link
            className="text-link"
            href={`?q=${encodeURIComponent(q)}&page=${page - 1}`}
          >
            ← Anterior
          </Link>
        )}
        <span className="field-help">{count ?? 0} eventos</span>
        {(count ?? 0) > page * 12 && (
          <Link
            className="text-link"
            href={`?q=${encodeURIComponent(q)}&page=${page + 1}`}
          >
            Siguiente →
          </Link>
        )}
      </nav>
    </>
  );
}

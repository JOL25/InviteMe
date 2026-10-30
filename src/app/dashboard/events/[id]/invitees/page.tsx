import Link from 'next/link';
import { ownedEvent } from '@/lib/events';
import { inviteSummary, ownedInvitees } from '@/lib/invitees';
import { AddInvitee, InviteeCard } from '@/components/invitee-manager';
export default async function Invitees({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const { id } = await params;
  const { event, user } = await ownedEvent(id);
  const search = await searchParams;
  const page = Math.max(
    1,
    Math.min(10000, Math.floor(Number(search.page) || 1)),
  );
  const status = ['pending', 'yes', 'no'].includes(search.status ?? '')
    ? search.status!
    : 'all';
  const [summary, list] = await Promise.all([
    inviteSummary(id, user.id),
    ownedInvitees(id, user.id, event.slug, page, status),
  ]);
  return (
    <>
      <Link className="back-link" href={`/dashboard/events/${id}/edit`}>
        ← Volver a editar
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">UNA LISTA PARA REUNIRLOS</span>
          <h1>Tus invitados.</h1>
          <p className="muted">{event.title}</p>
        </div>
        <Link
          className="button button-outline"
          href={`/dashboard/events/${id}/guests`}
        >
          Ver todas las respuestas
        </Link>
      </div>
      {!event.published_at && (
        <p className="notice">
          Publica la invitación para que tus invitados puedan abrir sus enlaces.
        </p>
      )}
      <div
        className="stats-grid invitee-stats"
        aria-label="Resumen de invitaciones individuales"
      >
        <article>
          <span>INVITACIONES EN LA LISTA</span>
          <strong>{summary.total}</strong>
          <p>Pueden incluir acompañantes</p>
        </article>
        <article>
          <span>PENDIENTES</span>
          <strong>{summary.pending}</strong>
          <p>Sin una respuesta individual</p>
        </article>
        <article>
          <span>CONFIRMARON</span>
          <strong>{summary.yes_count}</strong>
          <p>Invitaciones con respuesta sí</p>
        </article>
        <article>
          <span>NO ASISTIRÁN</span>
          <strong>{summary.no_count}</strong>
          <p>Invitaciones con respuesta no</p>
        </article>
      </div>
      <p className="field-help invitee-explanation">
        Los pendientes corresponden solo a esta lista, incluso si su enlace está
        desactivado. Las respuestas del enlace abierto no descuentan invitados.
        Cada enlace permite responder una vez por esa invitación; compártelo
        solo con su destinatario.
      </p>
      <AddInvitee eventId={id} />
      <form
        className="guest-filter"
        action={`/dashboard/events/${id}/invitees`}
      >
        <label>
          Mostrar invitados
          <select name="status" defaultValue={status}>
            <option value="all">Todos</option>
            <option value="pending">Pendientes</option>
            <option value="yes">Confirmaron</option>
            <option value="no">No asistirán</option>
          </select>
        </label>
        <button className="button button-outline">Filtrar invitados</button>
      </form>
      {list.rows.length ? (
        <div className="invitee-list">
          {list.rows.map((guest) => (
            <InviteeCard key={guest.id} eventId={id} guest={guest} />
          ))}
        </div>
      ) : (
        <section className="empty-state panel">
          <h2>
            {status === 'all'
              ? 'Tu lista empieza aquí.'
              : 'No hay invitados con este estado.'}
          </h2>
          <p className="muted">
            Añade invitados y comparte sus enlaces individuales.
          </p>
        </section>
      )}
      <nav className="pagination" aria-label="Paginación de invitados">
        {page > 1 && (
          <Link
            className="text-link"
            href={`?status=${status}&page=${page - 1}`}
          >
            ← Anterior
          </Link>
        )}
        <span className="field-help">{list.count} invitaciones</span>
        {list.count > page * 50 && (
          <Link
            className="text-link"
            href={`?status=${status}&page=${page + 1}`}
          >
            Siguiente →
          </Link>
        )}
      </nav>
    </>
  );
}

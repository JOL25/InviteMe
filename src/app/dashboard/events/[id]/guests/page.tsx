import Link from 'next/link';
import { Download, Users } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { ownedReplies } from '@/lib/event-store';
import { ownedEvent } from '@/lib/events';
import { inviteSummary } from '@/lib/invitees';
export default async function Guests({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; attendance?: string }>;
}) {
  const { id } = await params;
  const { event, user } = await ownedEvent(id);
  const { page: rawPage, attendance = 'all' } = await searchParams;
  const page = Math.max(1, Math.min(10000, Math.floor(Number(rawPage) || 1)));
  const { rows, count, summary } = await ownedReplies(
    id,
    user.id,
    attendance,
    page,
  );
  const invitations = await inviteSummary(id, user.id);
  return (
    <>
      <Link className="back-link" href={`/dashboard/events/${id}/edit`}>
        ← Volver a editar
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">LAS PERSONAS HACEN LA CELEBRACIÓN</span>
          <h1>¿Quién nos acompaña?</h1>
          <p className="muted">{event.title}</p>
        </div>
        <a className="button button-outline" href={`/api/events/${id}/export`}>
          <Download size={17} />
          Exportar CSV
        </a>
      </div>
      <div className="invitee-pending-banner">
        <p>
          <strong>{invitations.pending} pendientes</strong> de{' '}
          {invitations.total} invitaciones individuales.
        </p>
        <Link className="text-link" href={`/dashboard/events/${id}/invitees`}>
          Gestionar lista de invitados ↗
        </Link>
      </div>
      <div className="stats-grid">
        <article>
          <span>ASISTENTES CONFIRMADOS</span>
          <strong>{summary.attendee_count}</strong>
          <p>
            {event.capacity
              ? `de ${event.capacity} cupos`
              : 'Sin límite de cupos'}
          </p>
        </article>
        <article>
          <span>RESPUESTAS AFIRMATIVAS</span>
          <strong>{summary.yes_count}</strong>
          <p>Incluyen a sus acompañantes</p>
        </article>
        <article>
          <span>NO PODRÁN ASISTIR</span>
          <strong>{summary.no_count}</strong>
          <p>Gracias por avisar</p>
        </article>
      </div>
      <form className="guest-filter" action={`/dashboard/events/${id}/guests`}>
        <label>
          Mostrar
          <select name="attendance" defaultValue={attendance}>
            <option value="all">Todas las respuestas</option>
            <option value="yes">Asistirán</option>
            <option value="no">No asistirán</option>
          </select>
        </label>
        <button className="button button-outline">Filtrar</button>
      </form>
      {!rows?.length ? (
        <section className="empty-state panel">
          <Users size={36} strokeWidth={1} />
          <h2>Aún no hay respuestas aquí.</h2>
          <p className="muted">
            Comparte tu invitación para comenzar a recibir confirmaciones.
          </p>
          <Link className="button" href={`/dashboard/events/${id}/share`}>
            Compartir invitación
          </Link>
        </section>
      ) : (
        <div className="table-wrapper">
          <table>
            <caption className="sr-only">Respuestas de {event.title}</caption>
            <thead>
              <tr>
                <th scope="col">Invitado</th>
                <th scope="col">Respuesta</th>
                <th scope="col">Personas</th>
                <th scope="col">Mensaje</th>
                <th scope="col">Recibida</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.guest_name}</strong>
                    <small>{row.guest_email || 'Sin correo'}</small>
                    <small>
                      {row.guest_id
                        ? 'Invitación individual'
                        : 'Enlace abierto'}
                    </small>
                  </td>
                  <td>
                    <span
                      className={`badge ${row.attendance ? 'badge-live' : ''}`}
                    >
                      {row.cancelled_at
                        ? 'Canceló asistencia'
                        : row.attendance
                          ? 'Asistirá'
                          : 'No asistirá'}
                    </span>
                  </td>
                  <td>{row.attendance ? row.party_size : '—'}</td>
                  <td className="guest-note">{row.note || '—'}</td>
                  <td>
                    {formatInTimeZone(
                      row.created_at,
                      event.timezone,
                      'dd/MM/yyyy HH:mm',
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <nav className="pagination" aria-label="Paginación de respuestas">
        {page > 1 && (
          <Link
            className="text-link"
            href={`?attendance=${encodeURIComponent(attendance)}&page=${page - 1}`}
          >
            ← Anterior
          </Link>
        )}
        <span className="field-help">{count ?? 0} respuestas</span>
        {(count ?? 0) > page * 50 && (
          <Link
            className="text-link"
            href={`?attendance=${encodeURIComponent(attendance)}&page=${page + 1}`}
          >
            Siguiente →
          </Link>
        )}
      </nav>
      <p className="field-help">
        Una respuesta puede incluir varios asistentes. Solo los enlaces
        individuales descuentan pendientes de la lista; las respuestas abiertas
        se incluyen en los totales de asistencia.
      </p>
    </>
  );
}

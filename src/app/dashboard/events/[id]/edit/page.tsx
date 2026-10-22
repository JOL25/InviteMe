import Link from 'next/link';
import { EventForm } from '@/components/event-form';
import { PublishButton, DeleteButton } from '@/components/event-controls';
import { ownedEvent } from '@/lib/events';
export default async function EditEvent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { event } = await ownedEvent(id);
  return (
    <>
      <Link className="back-link" href="/dashboard">
        ← Mis eventos
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">CADA DETALLE CUENTA</span>
          <h1>{event.title}</h1>
          <span className={`badge ${event.published_at ? 'badge-live' : ''}`}>
            {event.published_at ? 'Publicada' : 'Borrador'}
          </span>
        </div>
        <PublishButton id={id} published={Boolean(event.published_at)} />
      </div>
      <nav className="tabs" aria-label="Gestionar evento">
        <span aria-current="page">Detalles y diseño</span>
        <Link href={`/dashboard/events/${id}/preview`}>Vista previa ↗</Link>
        <Link href={`/dashboard/events/${id}/guests`}>Respuestas</Link>
        <Link href={`/dashboard/events/${id}/share`}>Compartir y QR</Link>
      </nav>
      <EventForm event={event} />
      <div className="danger-zone">
        <DeleteButton id={id} />
      </div>
    </>
  );
}

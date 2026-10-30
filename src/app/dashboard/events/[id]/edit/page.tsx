import Link from 'next/link';
import { EventForm } from '@/components/event-form';
import { PublishButton, DeleteButton } from '@/components/event-controls';
import { ownedEvent } from '@/lib/events';
import { CoverForm } from '@/components/cover-form';
import { GalleryManager } from '@/components/gallery-manager';
import { ownedGallery } from '@/lib/gallery';
import { ownedActivities } from '@/lib/itinerary';
import { ItineraryManager } from '@/components/itinerary-manager';
export default async function EditEvent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { event, user } = await ownedEvent(id);
  const photos = await ownedGallery(id, user.id);
  const activities = await ownedActivities(id, user.id);
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
        <a href="#itinerary">Itinerario</a>
        <Link href={`/dashboard/events/${id}/preview`}>Vista previa ↗</Link>
        <Link href={`/dashboard/events/${id}/guests`}>Respuestas</Link>
        <Link href={`/dashboard/events/${id}/invitees`}>
          Lista de invitados
        </Link>
        <Link href={`/dashboard/events/${id}/share`}>Compartir y QR</Link>
      </nav>
      <EventForm event={event} />
      <CoverForm id={id} hasCover={Boolean(event.cover_path)} />
      <GalleryManager eventId={id} photos={photos} />
      <ItineraryManager
        eventId={id}
        timezone={event.timezone}
        startsAt={event.starts_at}
        activities={activities}
      />
      <div className="danger-zone">
        <DeleteButton id={id} />
      </div>
    </>
  );
}

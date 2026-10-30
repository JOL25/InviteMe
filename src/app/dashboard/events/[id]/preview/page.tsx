import Link from 'next/link';
import { coverUrl } from '@/lib/event-store';
import { ownedEvent } from '@/lib/events';
import { projectPublicEvent } from '@/lib/public-event';
import { Invitation } from '@/components/invitation';
import { ownedGallery, projectPhotos } from '@/lib/gallery';
import { ownedActivities } from '@/lib/itinerary';
export default async function Preview({
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
      <div className="preview-banner">
        <span>Vista previa privada · guarda los cambios antes de revisar.</span>
        <Link href={`/dashboard/events/${id}/edit`}>← Volver a editar</Link>
      </div>
      <Invitation
        event={projectPublicEvent(
          event,
          coverUrl(event.cover_path),
          projectPhotos(photos),
          activities,
        )}
        preview
      />
    </>
  );
}

import Link from 'next/link';
import { coverUrl } from '@/lib/event-store';
import { ownedEvent } from '@/lib/events';
import { projectPublicEvent } from '@/lib/public-event';
import { Invitation } from '@/components/invitation';
export default async function Preview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { event } = await ownedEvent(id);
  return (
    <>
      <div className="preview-banner">
        <span>Vista previa privada · guarda los cambios antes de revisar.</span>
        <Link href={`/dashboard/events/${id}/edit`}>← Volver a editar</Link>
      </div>
      <Invitation
        event={projectPublicEvent(event, coverUrl(event.cover_path))}
        preview
      />
    </>
  );
}

import Link from 'next/link';
import { ownedEvent } from '@/lib/events';
import { projectPublicEvent } from '@/lib/public-event';
import { Invitation } from '@/components/invitation';
export default async function Preview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { event, supabase } = await ownedEvent(id);
  const image = event.cover_path
    ? await supabase.storage
        .from('covers')
        .createSignedUrl(event.cover_path, 300)
    : null;
  return (
    <>
      <div className="preview-banner">
        <span>Vista previa privada · guarda los cambios antes de revisar.</span>
        <Link href={`/dashboard/events/${id}/edit`}>← Volver a editar</Link>
      </div>
      <Invitation
        event={projectPublicEvent(event, image?.data?.signedUrl ?? null)}
        preview
      />
    </>
  );
}

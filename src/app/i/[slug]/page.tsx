import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Invitation } from '@/components/invitation';
import { getPublicEvent } from '@/lib/public-event';
import { siteUrl } from '@/lib/env';
export const dynamic = 'force-dynamic';
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await getPublicEvent(slug);
  if (!event)
    return {
      title: 'Invitación no disponible',
      robots: { index: false, follow: false },
    };
  return {
    title: event.title,
    description:
      'Tenemos un momento especial para compartir contigo. Consulta los detalles y confirma tu asistencia.',
    robots: { index: false, follow: false },
    openGraph: {
      title: event.title,
      description: 'Tenemos una celebración y nos encantaría verte.',
      url: `${siteUrl()}/i/${event.slug}`,
      type: 'website',
    },
  };
}
export default async function PublicInvitation({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await getPublicEvent(slug);
  if (!event) notFound();
  return (
    <main id="main">
      <Invitation event={event} />
    </main>
  );
}

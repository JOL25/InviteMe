import { notFound } from 'next/navigation';
import { getPublicEvent } from '@/lib/public-event';
import { RSVPManager } from '@/components/rsvp-manager';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Gestionar mi respuesta',
  robots: { index: false, follow: false },
  referrer: 'no-referrer' as const,
};
export default async function Manage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await getPublicEvent(slug);
  if (!event) notFound();
  return (
    <main id="main" className="rsvp-management-page">
      <span className="eyebrow">CADA RESPUESTA CUENTA</span>
      <h1>Tu respuesta.</h1>
      <p className="muted">{event.title}</p>
      <RSVPManager slug={slug} />
    </main>
  );
}

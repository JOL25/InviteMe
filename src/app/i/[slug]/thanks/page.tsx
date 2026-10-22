import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Heart } from 'lucide-react';
import { getPublicEvent } from '@/lib/public-event';
import { Receipt } from '@/components/receipt';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Gracias por responder',
  robots: { index: false, follow: false },
};
export default async function Thanks({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await getPublicEvent(slug);
  if (!event) notFound();
  return (
    <main id="main" className="empty-state">
      <Heart size={42} strokeWidth={1} />
      <span className="eyebrow">CADA RESPUESTA CUENTA</span>
      <h1>Gracias por ser parte.</h1>
      <Receipt slug={slug} />
      <Link className="button" href={`/i/${slug}`}>
        Volver a la invitación
      </Link>
    </main>
  );
}

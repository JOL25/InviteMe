import Link from 'next/link';
import { Invitation } from '@/components/invitation';
import { sampleEvent } from '@/lib/sample';
export const metadata = {
  title: 'Una invitación de ejemplo',
  robots: { index: false, follow: false },
};
export default function Example() {
  return (
    <>
      <div className="preview-banner">
        <span>Una muestra de lo que puedes crear.</span>
        <Link href="/register">Crear mi invitación ↗</Link>
        <Link href="/">Volver al inicio</Link>
      </div>
      <main id="main">
        <Invitation event={sampleEvent} sample />
      </main>
    </>
  );
}

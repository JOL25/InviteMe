import Link from 'next/link';
import { EventForm } from '@/components/event-form';
export default function NewEvent() {
  return (
    <>
      <Link className="back-link" href="/dashboard">
        ← Mis eventos
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">HAGAMOS ALGO ESPECIAL</span>
          <h1>Una nueva celebración.</h1>
          <p className="muted">
            Cuéntanos los detalles. Nosotros ponemos la invitación.
          </p>
        </div>
      </div>
      <EventForm />
    </>
  );
}

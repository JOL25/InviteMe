import Link from 'next/link';
export default function NotFound() {
  return (
    <main id="main" className="empty-state">
      <span className="eyebrow">404 / POR AQUÍ NO ES</span>
      <h1>Esta invitación no está disponible.</h1>
      <p className="muted">Revisa el enlace o consulta con quien te invitó.</p>
      <Link className="button" href="/">
        Volver a InviteMe
      </Link>
    </main>
  );
}

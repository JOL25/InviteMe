import Link from 'next/link';
export default function AuthError() {
  return (
    <main id="main" className="empty-state">
      <h1>El enlace ya no está disponible.</h1>
      <p>Puede haber caducado o haber sido utilizado.</p>
      <Link className="button" href="/login">
        Ir a iniciar sesión
      </Link>
    </main>
  );
}

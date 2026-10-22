import { Brand } from '@/components/brand';
import Link from 'next/link';
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="auth-shell">
      <header className="site-header">
        <Brand />
        <Link className="text-link" href="/">
          Volver al inicio ↗
        </Link>
      </header>
      <main id="main" className="auth-main">
        <aside className="auth-aside">
          <span className="eyebrow">HECHO PARA CELEBRAR</span>
          <h2>
            Hay momentos
            <br />
            que se guardan
            <br />
            <em>para siempre.</em>
          </h2>
          <p>
            La invitación es solo el comienzo.
            <br />
            Haz que el tuyo sea especial.
          </p>
          <div className="flower-mark" aria-hidden="true">
            ✳
          </div>
        </aside>
        <section className="auth-panel">{children}</section>
      </main>
      <footer className="simple-footer">
        InviteMe · Hecho para reunir a quienes más quieres.
      </footer>
    </div>
  );
}

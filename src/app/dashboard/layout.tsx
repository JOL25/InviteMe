import Link from 'next/link';
import { Brand } from '@/components/brand';
import { requireUser } from '@/lib/auth';
import { signOut } from '@/actions/auth';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Mi espacio',
  robots: { index: false, follow: false },
};
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireUser();
  return (
    <>
      <header className="site-header dashboard-header">
        <Brand />
        <nav aria-label="Mi espacio">
          <Link className="text-link" href="/dashboard">
            Mis eventos
          </Link>
          <span className="user-email">{user.email}</span>
          <form action={signOut}>
            <button className="text-button">Salir</button>
          </form>
        </nav>
      </header>
      <main id="main" className="dashboard-main">
        {children}
      </main>
      <footer className="simple-footer">
        Hecho para reunir a quienes más quieres.
      </footer>
    </>
  );
}

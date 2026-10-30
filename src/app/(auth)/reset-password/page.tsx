import { RecoveryForm } from '@/components/recovery-form';
import { hasDatabase } from '@/lib/env';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Nueva contraseña',
  robots: { index: false, follow: false },
  referrer: 'no-referrer' as const,
};
export default function ResetPassword() {
  return (
    <>
      <span className="eyebrow">UN NUEVO COMIENZO</span>
      <h1>Elige tu nueva contraseña.</h1>
      <p className="muted intro">
        Al guardarla se cerrarán las sesiones anteriores de tu cuenta.
      </p>
      <RecoveryForm configured={hasDatabase()} reset />
    </>
  );
}

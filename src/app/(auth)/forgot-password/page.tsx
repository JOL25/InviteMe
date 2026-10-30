import { RecoveryForm } from '@/components/recovery-form';
import { hasDatabase } from '@/lib/env';
import { recoveryDelivery } from '@/lib/mail-config';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Recuperar contraseña',
  robots: { index: false, follow: false },
};
export default function ForgotPassword() {
  const delivery = recoveryDelivery();
  const configured = hasDatabase() && Boolean(delivery);
  return (
    <>
      <span className="eyebrow">VOLVAMOS A ENCONTRARNOS</span>
      <h1>Recupera tu cuenta.</h1>
      <p className="muted intro">
        Escribe el correo de tu cuenta para solicitar un enlace de recuperación.
      </p>
      <RecoveryForm configured={configured} />
      {configured && delivery === 'local' && (
        <p className="field-help">
          Modo local: consulta el buzón de este equipo con{' '}
          <code>npm run mail:local</code>. No se envían correos externos.
        </p>
      )}
    </>
  );
}

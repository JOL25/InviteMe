import { RecoveryForm } from '@/components/recovery-form';
import { hasDatabase } from '@/lib/env';
import { localRecoveryEnabled } from '../../../../scripts/local-mail.mjs';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Recuperar contraseña',
  robots: { index: false, follow: false },
};
export default function ForgotPassword() {
  const configured = hasDatabase() && localRecoveryEnabled();
  return (
    <>
      <span className="eyebrow">VOLVAMOS A ENCONTRARNOS</span>
      <h1>Recupera tu cuenta.</h1>
      <p className="muted intro">
        Escribe el correo de tu cuenta para solicitar un enlace de recuperación.
      </p>
      <RecoveryForm configured={configured} />
      {configured && (
        <p className="field-help">
          Modo local: consulta el buzón de este equipo con{' '}
          <code>npm run mail:local</code>. No se envían correos externos.
        </p>
      )}
    </>
  );
}

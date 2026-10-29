import { AuthForm } from '@/components/auth-form';
import { hasDatabase } from '@/lib/env';
export const metadata = {
  title: 'Iniciar sesión',
  robots: { index: false, follow: false },
};
export default function Login() {
  return (
    <>
      <span className="eyebrow">QUÉ BUENO VERTE</span>
      <h1>Bienvenido de nuevo.</h1>
      <p className="muted intro">Tus próximas celebraciones te esperan.</p>
      <AuthForm mode="login" configured={hasDatabase()} />
    </>
  );
}

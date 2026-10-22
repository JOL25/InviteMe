import { AuthForm } from '@/components/auth-form';
import { hasSupabase } from '@/lib/env';
export const metadata = {
  title: 'Crear cuenta',
  robots: { index: false, follow: false },
};
export default function Register() {
  return (
    <>
      <span className="eyebrow">TU PRÓXIMO GRAN MOMENTO</span>
      <h1>Empieza a celebrar.</h1>
      <p className="muted intro">
        Crea tu cuenta y dale forma a tu primera invitación.
      </p>
      <AuthForm mode="register" configured={hasSupabase()} />
    </>
  );
}

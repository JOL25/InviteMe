import type { Metadata } from 'next';
import { MotionProvider } from '@/components/motion-provider';
import './globals.css';
export const metadata: Metadata = {
  title: {
    default: 'InviteMe · Momentos que merecen una invitación',
    template: '%s | InviteMe',
  },
  description:
    'Crea invitaciones digitales, comparte tu celebración y recibe confirmaciones en un solo lugar.',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <a className="skip-link" href="#main">
          Saltar al contenido
        </a>
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}

# InviteMe

Invitaciones digitales con confirmación de asistencia. Next.js App Router, TypeScript, Tailwind CSS y Supabase.

## Desarrollo

Requiere Node.js 22 y npm. Instala con `npm ci`, copia `.env.example` a `.env.local` y ejecuta `npm run dev`.

La landing funciona sin credenciales. Las funciones de cuenta, eventos y RSVP requieren configurar Supabase.

## Comprobaciones

- `npm run check`: ESLint, TypeScript y pruebas.
- `npm run build`: compilación de producción.
- `npm run test:e2e`: pruebas de navegador (requiere `npx playwright install chromium`).
- `npm run format:check`: formato.

## Alcance

Una plantilla clásica, portada, paleta y mensaje; eventos por propietario, vista previa privada, publicación, RSVP abierto, invitados, CSV y QR. Sin pagos, mensajería automática, galería, itinerario ni contador de invitados pendientes.

Consulta [las decisiones](docs/decisions.md) y [el progreso](docs/progress.md).

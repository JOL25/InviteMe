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

## Conexión y despliegue

Sigue [la guía de despliegue](docs/deployment.md) para aplicar las migraciones, configurar Auth y Storage y desplegar en Vercel. El código no contiene credenciales. Las verificaciones conectadas y de concurrencia real quedan señaladas allí como pendientes.

## Rutas principales

`/` landing · `/ejemplo` muestra interactiva sin envíos · `/login` · `/register` · `/dashboard` · `/dashboard/events/new` · `/dashboard/events/[id]/edit` · `/dashboard/events/[id]/preview` · `/dashboard/events/[id]/guests` · `/dashboard/events/[id]/share` · `/i/[slug]`.

## Seguridad de dependencias

`npm audit --omit=dev` no reporta vulnerabilidades en la comprobación inicial. La auditoría completa señala cinco avisos de desarrollo por la cadena `eslint-config-next → fast-glob → micromatch → braces`. La solución automática propuesta implica retroceder el framework y no se aplica. Revisar estos avisos al actualizar las herramientas. ESLint 9 se mantiene por compatibilidad declarada de los plugins de Next.js, y TypeScript 5.9 por compatibilidad con el analizador.

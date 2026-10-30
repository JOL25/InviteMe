# InviteMe

Invitaciones digitales con confirmación de asistencia. Next.js App Router, TypeScript, Tailwind CSS y PostgreSQL local.

## Desarrollo

Requiere Node.js 22, npm y PostgreSQL 17. En este equipo:

```powershell
npm ci
npm run db:start
npm run dev -- --port 3101
```

Abre http://localhost:3101. `db:start` prepara una instancia exclusiva en el puerto 55432 y configura la conexión sin modificar las bases de otros proyectos. Registra una cuenta nueva en `/register`; no se necesita Supabase ni confirmación por correo. No borres `.local/`, donde se conservan los datos.

## Galería

Abre un evento en **Detalles y diseño → Tu galería**. Puedes subir hasta ocho fotos JPG/PNG/WebP de 3 MB, describirlas, añadir un pie, cambiar su orden y eliminarlas. Se incluyen en la vista previa y aparecen para tus invitados al publicar. Al pulsar una foto, se abre un visor con controles de teclado y cierre con Escape.

## Animaciones

Al entrar, el título aparece por líneas desde ambos lados y las secciones se revelan al desplazarte. Los botones y las preguntas frecuentes responden al clic. En la esquina inferior derecha puedes activar/desactivar los efectos y pulsar **Repetir entrada**. La elección se recuerda en el navegador; inicialmente se respeta la preferencia de movimiento reducido del sistema.

## Comprobaciones

- `npm run check`: ESLint, TypeScript y pruebas.
- `npm run build`: compilación de producción.
- `npm run test:e2e`: pruebas de navegador (requiere `npx playwright install chromium`).
- `npm run format:check`: formato.
- `npm run test:local`: flujo completo contra una base PostgreSQL temporal.
- `npm run db:status` / `npm run db:stop`: consultar o detener la instancia local.

## Alcance

Una plantilla clásica, portada, galería de hasta ocho fotos, paleta y mensaje; eventos por propietario, vista previa privada, publicación, RSVP abierto, invitados, CSV y QR. Sin pagos, mensajería automática, galería, itinerario ni contador de invitados pendientes.

Consulta [las decisiones](docs/decisions.md) y [el progreso](docs/progress.md).

## Conexión y despliegue

Sigue [la guía local y de despliegue](docs/deployment.md) para usar otra instancia, aplicar migraciones, respaldar datos y configurar el sitio. Las credenciales no se versionan.

Supabase continúa pausado. Por decisión del propietario, la base local empieza vacía y no contiene cuentas, eventos ni respuestas del servicio anterior. Los documentos de verificación de Supabase son históricos.

## Rutas principales

`/` landing · `/ejemplo` muestra interactiva sin envíos · `/login` · `/register` · `/dashboard` · `/dashboard/events/new` · `/dashboard/events/[id]/edit` · `/dashboard/events/[id]/preview` · `/dashboard/events/[id]/guests` · `/dashboard/events/[id]/share` · `/i/[slug]`.

## Seguridad de dependencias

Dependencias fijadas y lockfile versionado. Ejecuta `npm audit --omit=dev` después de actualizarlas.

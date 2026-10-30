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

## Itinerario

En **Detalles y diseño → Itinerario**, añade hasta 20 actividades con título, fecha y hora, descripción y lugar opcionales. Se ordenan automáticamente por fecha y hora usando la zona del evento y admiten varios días. Puedes editarlas o eliminarlas con confirmación. Se muestran en la vista previa y en la invitación publicada; cuando la lista está vacía, la sección desaparece. Si cambias la zona horaria del evento, los instantes guardados se conservan y se muestran en la nueva zona.

## Comprobaciones

- `npm run check`: ESLint, TypeScript y pruebas.
- `npm run build`: compilación de producción.
- `npm run test:e2e`: pruebas de navegador (requiere `npx playwright install chromium`).
- `npm run format:check`: formato.
- `npm run test:local`: flujo completo contra una base PostgreSQL temporal.
- `npm run test:smtp`: recuperación contra una base temporal y un SMTP de captura local, sin envío externo.
- `npm run db:status` / `npm run db:stop`: consultar o detener la instancia local.

## Recuperar una cuenta en este equipo

En **Iniciar sesión → Olvidé mi contraseña**, solicita un enlace usando el correo de la cuenta. Consulta el buzón privado desde la carpeta del proyecto:

```powershell
npm run mail:local
# Opcional: filtrar por destinatario
npm run mail:local -- --email tu@correo.com
```

Abre el enlace más reciente, escribe la nueva contraseña dos veces e inicia sesión de nuevo. El enlace dura 30 minutos y funciona una sola vez; pedir otro sustituye al anterior. Cambiar la contraseña cierra las sesiones abiertas y conserva tus eventos. Los mensajes locales caducan automáticamente. El buzón está en `.local/mail`, fuera de Git y sin acceso por la web. No se envían correos externos. El soporte SMTP está preparado; su activación queda pendiente de un proveedor y remitente. Consulta [la guía de correo](docs/email.md).

## Alcance

Una plantilla clásica, portada, galería de hasta ocho fotos, itinerario de hasta 20 actividades, paleta y mensaje; eventos por propietario, vista previa privada, publicación, RSVP abierto e individual con edición/cancelación, lista de invitados con pendientes, CSV y QR. Sin pagos ni mensajería automática.

En **Lista de invitados**, añade nombres, contacto opcional y cupo por invitación. Comparte manualmente el enlace individual de cada persona después de publicar. Puedes renovarlo o desactivarlo. Cada invitación permite una respuesta; los pendientes cuentan invitaciones de esta lista, incluso las desactivadas. Las respuestas abiertas se distinguen en el panel y el CSV y no descuentan pendientes por coincidencias de nombre o correo. Conserva `INVITATION_LINK_SECRET` al respaldar o mover el proyecto para poder recuperar los mismos enlaces desde el panel.

Después de responder, **Gestionar mi respuesta** permite cambiar asistencia, acompañantes, correo y mensaje. El nombre de una invitación individual se conserva. Los invitados nominativos pueden volver a su enlace original; las nuevas respuestas abiertas reciben un enlace privado de gestión que deben guardar. Cancelar libera todos los cupos de esa respuesta y queda identificado en el panel y CSV; no vuelve a contar como pendiente. Con las confirmaciones cerradas solo se permite cancelar. Para volver a confirmar se necesitan cupos y confirmaciones abiertas. Las respuestas abiertas anteriores a esta función siguen registradas, pero no se les puede recuperar un enlace por nombre o correo.

Consulta [las decisiones](docs/decisions.md) y [el progreso](docs/progress.md).

## Conexión y despliegue

Sigue [la guía local y de despliegue](docs/deployment.md) para usar otra instancia, aplicar migraciones, respaldar datos y configurar el sitio. Las credenciales no se versionan.

Para guardar cuentas, eventos, invitados, respuestas y fotos, ejecuta `npm run db:backup`. Comprueba el archivo con `npm run db:verify -- --backup "RUTA_DEL_RESPALDO"`. Consulta [Respaldo y recuperación](docs/backups.md) para restaurar una copia sin sustituir la base activa y trasladarla a otra PC.

Supabase continúa pausado. Por decisión del propietario, la base local empieza vacía y no contiene cuentas, eventos ni respuestas del servicio anterior. Los documentos de verificación de Supabase son históricos.

## Rutas principales

`/` landing · `/ejemplo` muestra interactiva sin envíos · `/login` · `/register` · `/forgot-password` · `/reset-password` · `/dashboard` · `/dashboard/events/new` · `/dashboard/events/[id]/edit` · `/dashboard/events/[id]/preview` · `/dashboard/events/[id]/invitees` · `/dashboard/events/[id]/guests` · `/dashboard/events/[id]/share` · `/i/[slug]`.

## Seguridad de dependencias

Dependencias fijadas y lockfile versionado. Ejecuta `npm audit --omit=dev` después de actualizarlas.

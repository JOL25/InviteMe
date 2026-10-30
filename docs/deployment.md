# PostgreSQL local y ejecución

Desde el 29 de octubre de 2026 InviteMe usa PostgreSQL directo mediante `pg`. Supabase permanece pausado y sus datos no se importaron, por decisión del propietario. La base nueva empieza vacía. Los archivos de `supabase/` y `docs/supabase-verification.md` se conservan únicamente como historial del backend anterior; no se ejecutan ni se necesitan sus claves.

## Inicio en este equipo

Requiere Node.js 22 y PostgreSQL 17. El helper utiliza los binarios instalados en `C:/Program Files/PostgreSQL/17/bin`. Para otra instalación configura `PG_BIN` con la carpeta que contiene `initdb` y `pg_ctl`.

```powershell
npm ci
npm run db:start
npm run dev -- --port 3101
```

`db:start` crea y arranca una instancia exclusiva en `127.0.0.1:55432`, crea el dueño de migraciones `inviteme_app`, el usuario restringido `inviteme_runtime`, la base `inviteme` y aplica las migraciones pendientes. `DATABASE_URL` en `.env.local` usa solamente el usuario restringido. `DATABASE_MIGRATION_URL` se guarda en `.env.database`, que Next.js no carga. No modifica el servicio PostgreSQL de Windows ni las bases de otros proyectos. Es idempotente. Solo escucha conexiones locales y exige SCRAM; las contraseñas aleatorias y los datos viven en `.local/`, excluido de Git. El helper no es un instalador de PostgreSQL ni un servicio de inicio automático: repite `db:start` después de reiniciar el equipo.

```powershell
npm run db:status
npm run db:stop
npm run db:migrate
```

`db:stop` detiene solo esta instancia. No borres `.local/`: contiene los datos y las credenciales de esta instalación. Ejecuta `npm run db:backup` para respaldar la base completa y la configuración privada de enlaces. `npm run db:verify -- --backup "RUTA_DEL_RESPALDO"` comprueba una restauración temporal. La [guía de respaldo y recuperación](backups.md) explica cómo guardar una copia fuera del equipo y restaurar sin sustituir la base activa.

## Otra instancia de PostgreSQL

Puedes usar una base dedicada existente en vez del helper: crea dos roles distintos: dueño de tablas/migraciones y usuario de aplicación sin superusuario, BYPASSRLS ni pertenencia al dueño. Configura `DATABASE_URL` del usuario restringido en `.env.local` y `DATABASE_MIGRATION_URL` del dueño en `.env.database`; ejecuta `npm run db:migrate`. No ejecutes `db:start` en ese caso, porque selecciona la instancia del helper. Solo el usuario de migraciones debe ser dueño de esa base. El usuario de aplicación no puede ser dueño de las tablas: la aplicación rechaza esa configuración. El administrador de PostgreSQL debe crear ambos roles previamente. Las migraciones de `database/migrations/` se aplican dentro de una transacción, con bloqueo y checksum. No edites una migración aplicada: añade otra.

## Cuentas y acceso

El registro local inicia sesión inmediatamente; no envía correo de confirmación. Las cuentas anteriores de Supabase no existen aquí. Contraseñas con scrypt y sal aleatoria, sesiones aleatorias de siete días cuyo token se guarda solo como SHA-256 en PostgreSQL, cookies HttpOnly y SameSite=Lax. Cerrar sesión revoca el token en la base. El acceso a cada operación privada verifica sesión y propietario, y RLS limita las filas de eventos, respuestas y portadas. La identidad se configura con SET LOCAL dentro de cada transacción, y desaparece al confirmar o revertir; no hay Data API, JWT de Supabase ni acceso a PostgreSQL desde el navegador. Las consultas usan parámetros. Los límites de autenticación y RSVP persisten en la base. Cuentas, sesiones, límites y migraciones tienen RLS sin políticas públicas y no conceden lectura directa al usuario de aplicación. Funciones acotadas con SECURITY DEFINER y search_path vacío permiten autenticación, proyección pública y RSVP transaccional; sus permisos están enumerados en `scripts/runtime-grants.mjs`. El rol de aplicación es exclusivo del backend: nunca se entrega al navegador.

Las portadas de hasta 3 MB se almacenan como `bytea`, con reemplazo transaccional y borrado en cascada. `/api/covers/[id]` comprueba que el evento esté publicado o que la sesión pertenezca al dueño, en cada petición. Despublicar corta el acceso público sin esperar a que caduque una URL firmada.

## Recuperación de contraseña local

Las migraciones `007_password_recovery.sql` y `008_recovery_issuance_variable.sql` incorporan enlaces privados, límites y apertura de sesión condicionada al hash de contraseña verificado. La segunda corrige un nombre de variable ambiguo sin modificar la primera migración ya aplicada. Las tablas de recuperación tienen RLS y no conceden acceso directo al runtime; este solo ejecuta funciones enumeradas con search_path vacío. El enlace se guarda como SHA-256, caduca en 30 minutos y se consume bajo bloqueo del usuario; revoca todas sus sesiones. Un login que verificó la contraseña anterior no puede abrir sesión después del cambio. Los datos del evento no se modifican.

`db:start` configura `PASSWORD_RESET_DELIVERY=local` si falta. Este modo solo funciona con `NEXT_PUBLIC_SITE_URL` de localhost, 127.0.0.1 o ::1; no debe usarse como entrega para un dominio público. Los mensajes se guardan en `.local/mail`, accesibles solo desde el filesystem. `npm run mail:local` permite consultar los vigentes; admite `-- --email tu@correo.com`. Contienen el enlace privado en texto para que puedas abrirlo: protege el directorio como las credenciales locales. No lo publiques ni lo incluyas en un respaldo compartido. La CLI y las nuevas entregas eliminan mensajes caducados. En modo local no se envía correo externo ni hay una bandeja pública en la web. El soporte SMTP está preparado: su configuración y verificación con un proveedor se explican en [Correo de recuperación](email.md).

La solicitud usa respuesta y tiempo mínimo comunes para correos registrados/desconocidos o limitados. Admite hasta tres solicitudes por correo y diez por IP cada 15 minutos; los intentos de consumo tienen un límite separado de diez por IP. Se usa HMAC con el secreto existente y dominio separado para las claves del límite. Las API validan origen, JSON de hasta 4 KiB, contraseña de 10 a 128 caracteres y confirmación coincidente. No revelan el token ni el correo en la respuesta. El token viaja en el fragmento y se envía al consumirlo por POST; visitar el enlace no lo consume. No hay inicio de sesión automático tras el cambio. El aviso de cambio se conserva en el mismo buzón local, sin contraseña.

La base de pruebas y el buzón se aíslan juntos en `test:local` y se eliminan al terminar, sin leer el buzón de uso diario. Para repetir el flujo: `npm run test:local -- recovery.spec.ts`. El diseño sigue las recomendaciones de [OWASP sobre recuperación de contraseñas](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html): respuesta genérica, token aleatorio limitado a un uso, caducidad, confirmación de contraseña y revocación de sesiones.

## Galería de fotos

En la edición del evento, **Tu galería** permite añadir hasta ocho fotos de 3 MB cada una, JPG/PNG/WebP, con descripción obligatoria y pie opcional. Se carga una por petición, de modo que el límite de Server Actions sigue siendo 4 MB. La API comprueba la firma del archivo sin confiar en nombre o MIME enviados. Puedes editar los textos, cambiar el orden y eliminar con confirmación. La vista previa incluye las fotos de borrador; la URL pública solo las sirve mientras el evento esté publicado. El visor ampliado admite flechas, Escape y devolución del foco al botón de origen.

La migración `003_event_gallery.sql` agrega RLS, posiciones únicas del 0 al 7, identidad inmutable y borrado en cascada. El rol restringido recibe permisos explícitos de la tabla y de las funciones de proyección/lectura. `/api/photos/[id]` responde sin caché y verifica acceso en cada petición. La ruta de bytes no expone los nombres originales de archivo. Sin fotos, la sección no aparece en la invitación.

## Itinerario

El itinerario se almacena en `event_activities` mediante la migración `005_event_itinerary.sql`. Incluye título, descripción/lugar opcionales y `starts_at`; el respaldo completo de la base incluye estas filas. RLS restringe las escrituras y lecturas privadas al propietario. El límite de 20 actividades se comprueba bajo bloqueo del evento tanto en el backend como al insertar en SQL. La función pública enumera únicamente los campos de la actividad y exige publicación. La interfaz interpreta las fechas en la zona del evento y las presenta en esa misma zona, también sin JavaScript; cambiarla conserva los instantes ya guardados. Prueba conectada específica: `npm run test:local -- itinerary.spec.ts`.

## Variables

- `DATABASE_MIGRATION_URL`: solo comandos de migración, en `.env.database`. No configurar en el proceso de la web.
- `DATABASE_URL`: conexión privada del usuario restringido; nunca usar un prefijo `NEXT_PUBLIC_`.
- `NEXT_PUBLIC_SITE_URL`: URL del sitio. Usa `http://localhost:3101` para el comando de desarrollo anterior; determina también si la cookie exige HTTPS.
- `RSVP_RATE_LIMIT_SECRET`: secreto aleatorio de al menos 32 caracteres; el helper lo genera si falta.
- `INVITATION_LINK_SECRET`: secreto estable de al menos 32 caracteres para reconstruir los enlaces individuales; el helper lo genera si falta. Respáldalo junto con la base, fuera de Git. Si se pierde o cambia, el panel exige renovar los enlaces; los anteriores siguen siendo válidos hasta renovarlos o desactivarlos.
- `PASSWORD_RESET_DELIVERY`: `local` para el buzón del equipo o `smtp` para un proveedor configurado. El helper conserva la elección existente y configura `local` si falta. `smtp-test` queda reservado al runner de pruebas.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`: variables privadas del servidor, solo necesarias con entrega SMTP. El puerto 465 usa TLS implícito; otros puertos exigen STARTTLS. Credenciales y remitente son obligatorios en modo `smtp`.
- `PASSWORD_RESET_OUTBOX`: opcional, directorio del buzón dentro de `.local`; por defecto `.local/mail`. El runner configura otro directorio exclusivo para cada base de pruebas y lo elimina al terminar.
- Las dos claves Turnstile siguen siendo opcionales, pero deben configurarse juntas para exigir CAPTCHA.

Antes de publicar fuera del equipo se necesitan HTTPS, una base accesible desde el servidor y copias de seguridad. `127.0.0.1` en un hosting remoto se refiere a ese servidor, no a tu PC. Para producción configura `NEXT_PUBLIC_SITE_URL=https://...` para cookies Secure. Los encabezados de IP deben proceder de un proxy de confianza si se habilita acceso público. La recuperación local usa un buzón privado; el envío por correo real requiere conectar un proveedor.

## Verificación

`npm run check` ejecuta lint, tipos, validadores, contraseñas y SQL real compilado a WASM. `npm run test:e2e` comprueba el sitio sin configuración, en escritorio y móvil. `npm run test:local` crea una base temporal en PostgreSQL real, aplica migraciones y ejecuta los flujos privados y públicos desde el navegador; la elimina al terminar. Usa las credenciales administrativas del helper o `TEST_DATABASE_ADMIN_URL` para una instancia de pruebas. Nunca apunta las pruebas a la base de uso diario. En CI se utiliza un servicio PostgreSQL aislado.

Para repetir solo la prueba conectada de galería puedes usar `npm run test:local -- gallery.spec.ts`. Las imágenes de esta prueba se generan localmente y no son fotografías personales.

## Invitaciones individuales

La migración `004_named_invitations.sql` añade la lista privada de invitados con RLS y una respuesta única por invitación. El cupo individual incluye al invitado y sus acompañantes; todas las confirmaciones comparten el cupo global del evento. Las operaciones y las respuestas bloquean la misma fila del evento para evitar excederlo con envíos simultáneos.

Los enlaces se comparten manualmente desde **Lista de invitados**. El token viaja en el fragmento `#invitado=`, que el navegador no envía al servidor al navegar; el formulario lo valida mediante JSON por POST. La base conserva un hash del token y un nonce, y el servidor reconstruye el enlace con HMAC. El endpoint público solo devuelve nombre, cupo y respuesta de esa invitación, sin contactos ni lista completa. Es un enlace de acceso: quien lo reciba podrá responder y gestionar la respuesta de su destinatario.

Renovar o desactivar invalida el enlace anterior y conserva las respuestas. Los registros de la lista sin respuesta se pueden editar o eliminar; los datos de la lista de quienes respondieron se conservan. Los pendientes cuentan registros sin respuesta individual, incluyendo los desactivados. El enlace abierto no vincula respuestas por nombres o correos. La lista se pagina y filtra por estado; el panel de respuestas y CSV indican el origen. No hay envíos automáticos. Para repetir las pruebas conectadas: `npm run test:local -- invitees.spec.ts`.

## Edición y cancelación de respuestas

La migración `006_rsvp_management.sql` agrega capacidad privada para respuestas abiertas nuevas, versión, fecha de actualización y marca de cancelación. La capacidad se asigna solo al alta; un reintento nunca añade ni reemplaza el hash de una respuesta previa. Los enlaces antiguos abiertos sin capacidad no son recuperables por nombre, correo, UUID de respuesta ni clave de reintento. Los enlaces nominativos existentes ya permiten gestionar sus respuestas; renovarlos o desactivarlos invalida también la gestión anterior.

La página `/i/[slug]/manage` no incluye datos privados en el HTML del servidor. El navegador resuelve el fragmento `#respuesta=` o `#invitado=` mediante POST con control de origen, JSON acotado y respuesta sin caché. Se puede corregir nombre solo en respuestas abiertas; el nombre nominativo y el cupo individual proceden del registro. Los cambios usan el mismo límite de intentos y CAPTCHA opcional del alta; el runtime conserva permiso de solo lectura directa sobre RSVP. Funciones acotadas con search_path vacío validan la capacidad y bloquean el evento para coordinar altas, ampliaciones, reducciones y cancelaciones. La versión impide sobrescrituras desde pestañas antiguas.

Cancelar conserva la respuesta, la marca como no asistente y libera todos sus cupos; el panel y CSV la identifican como cancelada. Los pendientes no aumentan. Con RSVP cerrado se puede cancelar, pero no editar o reconfirmar. Una invitación despublicada impide todas las operaciones públicas. El agradecimiento ofrece el enlace privado de gestión, que debe guardarse; si sessionStorage está bloqueado, lo conserva en el fragmento de la pantalla de agradecimiento. No se envía por correo ni se recupera automáticamente si se pierde. Prueba específica: `npm run test:local -- rsvp-management.spec.ts`.

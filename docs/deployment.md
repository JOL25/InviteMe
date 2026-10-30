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

`db:stop` detiene solo esta instancia. No borres `.local/`: contiene los datos y las credenciales de esta instalación. Para respaldo, usa `pg_dump` con la conexión `DATABASE_MIGRATION_URL` de `.env.database`, que puede leer todas las tablas protegidas por RLS, y guarda el archivo fuera del repositorio; incluye usuarios, sesiones, eventos, respuestas, portadas y fotos de galería.

## Otra instancia de PostgreSQL

Puedes usar una base dedicada existente en vez del helper: crea dos roles distintos: dueño de tablas/migraciones y usuario de aplicación sin superusuario, BYPASSRLS ni pertenencia al dueño. Configura `DATABASE_URL` del usuario restringido en `.env.local` y `DATABASE_MIGRATION_URL` del dueño en `.env.database`; ejecuta `npm run db:migrate`. No ejecutes `db:start` en ese caso, porque selecciona la instancia del helper. Solo el usuario de migraciones debe ser dueño de esa base. El usuario de aplicación no puede ser dueño de las tablas: la aplicación rechaza esa configuración. El administrador de PostgreSQL debe crear ambos roles previamente. Las migraciones de `database/migrations/` se aplican dentro de una transacción, con bloqueo y checksum. No edites una migración aplicada: añade otra.

## Cuentas y acceso

El registro local inicia sesión inmediatamente; no envía correo de confirmación. Las cuentas anteriores de Supabase no existen aquí. Contraseñas con scrypt y sal aleatoria, sesiones aleatorias de siete días cuyo token se guarda solo como SHA-256 en PostgreSQL, cookies HttpOnly y SameSite=Lax. Cerrar sesión revoca el token en la base. El acceso a cada operación privada verifica sesión y propietario, y RLS limita las filas de eventos, respuestas y portadas. La identidad se configura con SET LOCAL dentro de cada transacción, y desaparece al confirmar o revertir; no hay Data API, JWT de Supabase ni acceso a PostgreSQL desde el navegador. Las consultas usan parámetros. Los límites de autenticación y RSVP persisten en la base. Cuentas, sesiones, límites y migraciones tienen RLS sin políticas públicas y no conceden lectura directa al usuario de aplicación. Funciones acotadas con SECURITY DEFINER y search_path vacío permiten autenticación, proyección pública y RSVP transaccional; sus permisos están enumerados en `scripts/runtime-grants.mjs`. El rol de aplicación es exclusivo del backend: nunca se entrega al navegador.

Las portadas de hasta 3 MB se almacenan como `bytea`, con reemplazo transaccional y borrado en cascada. `/api/covers/[id]` comprueba que el evento esté publicado o que la sesión pertenezca al dueño, en cada petición. Despublicar corta el acceso público sin esperar a que caduque una URL firmada.

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
- Las dos claves Turnstile siguen siendo opcionales, pero deben configurarse juntas para exigir CAPTCHA.

Antes de publicar fuera del equipo se necesitan HTTPS, una base accesible desde el servidor y copias de seguridad. `127.0.0.1` en un hosting remoto se refiere a ese servidor, no a tu PC. Para producción configura `NEXT_PUBLIC_SITE_URL=https://...` para cookies Secure. Los encabezados de IP deben proceder de un proxy de confianza si se habilita acceso público. La recuperación de contraseña por correo no forma parte del flujo local actual.

## Verificación

`npm run check` ejecuta lint, tipos, validadores, contraseñas y SQL real compilado a WASM. `npm run test:e2e` comprueba el sitio sin configuración, en escritorio y móvil. `npm run test:local` crea una base temporal en PostgreSQL real, aplica migraciones y ejecuta los flujos privados y públicos desde el navegador; la elimina al terminar. Usa las credenciales administrativas del helper o `TEST_DATABASE_ADMIN_URL` para una instancia de pruebas. Nunca apunta las pruebas a la base de uso diario. En CI se utiliza un servicio PostgreSQL aislado.

Para repetir solo la prueba conectada de galería puedes usar `npm run test:local -- gallery.spec.ts`. Las imágenes de esta prueba se generan localmente y no son fotografías personales.

## Invitaciones individuales

La migración `004_named_invitations.sql` añade la lista privada de invitados con RLS y una respuesta única por invitación. El cupo individual incluye al invitado y sus acompañantes; todas las confirmaciones comparten el cupo global del evento. Las operaciones y las respuestas bloquean la misma fila del evento para evitar excederlo con envíos simultáneos.

Los enlaces se comparten manualmente desde **Lista de invitados**. El token viaja en el fragmento `#invitado=`, que el navegador no envía al servidor al navegar; el formulario lo valida mediante JSON por POST. La base conserva un hash del token y un nonce, y el servidor reconstruye el enlace con HMAC. El endpoint público solo devuelve nombre, cupo y respuesta de esa invitación, sin contactos ni lista completa. Es un enlace de acceso: quien lo reciba podrá responder por su destinatario.

Renovar o desactivar invalida el enlace anterior y conserva las respuestas. Los registros sin respuesta se pueden editar o eliminar; los que respondieron se conservan sin cambios. Los pendientes cuentan registros sin respuesta individual, incluyendo los desactivados. El enlace abierto no vincula respuestas por nombres o correos. La lista se pagina y filtra por estado; el panel de respuestas y CSV indican el origen. No hay envíos automáticos ni edición/cancelación de respuestas en esta etapa. Para repetir las pruebas conectadas: `npm run test:local -- invitees.spec.ts`.

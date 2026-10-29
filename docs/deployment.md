# PostgreSQL local y ejecución

Desde el 29 de octubre de 2026 InviteMe usa PostgreSQL directo mediante `pg`. Supabase permanece pausado y sus datos no se importaron, por decisión del propietario. La base nueva empieza vacía. Los archivos de `supabase/` y `docs/supabase-verification.md` se conservan únicamente como historial del backend anterior; no se ejecutan ni se necesitan sus claves.

## Inicio en este equipo

Requiere Node.js 22 y PostgreSQL 17. El helper utiliza los binarios instalados en `C:/Program Files/PostgreSQL/17/bin`. Para otra instalación configura `PG_BIN` con la carpeta que contiene `initdb` y `pg_ctl`.

```powershell
npm ci
npm run db:start
npm run dev -- --port 3101
```

`db:start` crea y arranca una instancia exclusiva en `127.0.0.1:55432`, crea el rol `inviteme_app` sin permisos de superusuario, la base `inviteme`, configura `DATABASE_URL` en `.env.local` y aplica las migraciones pendientes. No modifica el servicio PostgreSQL de Windows ni las bases de otros proyectos. Es idempotente. Solo escucha conexiones locales y exige SCRAM; las contraseñas aleatorias y los datos viven en `.local/`, excluido de Git. El helper no es un instalador de PostgreSQL ni un servicio de inicio automático: repite `db:start` después de reiniciar el equipo.

```powershell
npm run db:status
npm run db:stop
npm run db:migrate
```

`db:stop` detiene solo esta instancia. No borres `.local/`: contiene los datos y las credenciales de esta instalación. Para respaldo, usa `pg_dump` contra `DATABASE_URL` y guarda el archivo fuera del repositorio; incluye usuarios, sesiones, eventos, respuestas y portadas.

## Otra instancia de PostgreSQL

Puedes usar una base dedicada existente en vez del helper: configura `DATABASE_URL` en `.env.local` y ejecuta `npm run db:migrate`. No ejecutes `db:start` en ese caso, porque selecciona la instancia del helper. El usuario de conexión debe ser dueño de esa base para crear tablas, esquema privado y funciones; no necesita ser superusuario. Las migraciones de `database/migrations/` se aplican dentro de una transacción, con bloqueo y checksum. No edites una migración aplicada: añade otra.

## Cuentas y acceso

El registro local inicia sesión inmediatamente; no envía correo de confirmación. Las cuentas anteriores de Supabase no existen aquí. Contraseñas con scrypt y sal aleatoria, sesiones aleatorias de siete días cuyo token se guarda solo como SHA-256 en PostgreSQL, cookies HttpOnly y SameSite=Lax. Cerrar sesión revoca el token en la base. El acceso a cada operación privada verifica sesión y propietario; no hay Data API, JWT de Supabase ni acceso a PostgreSQL desde el navegador. Las consultas usan parámetros. Los límites de autenticación y RSVP persisten en la base.

Las portadas de hasta 3 MB se almacenan como `bytea`, con reemplazo transaccional y borrado en cascada. `/api/covers/[id]` comprueba que el evento esté publicado o que la sesión pertenezca al dueño, en cada petición. Despublicar corta el acceso público sin esperar a que caduque una URL firmada.

## Variables

- `DATABASE_URL`: conexión privada; nunca usar un prefijo `NEXT_PUBLIC_`.
- `NEXT_PUBLIC_SITE_URL`: URL del sitio. Usa `http://localhost:3101` para el comando de desarrollo anterior; determina también si la cookie exige HTTPS.
- `RSVP_RATE_LIMIT_SECRET`: secreto aleatorio de al menos 32 caracteres; el helper lo genera si falta.
- Las dos claves Turnstile siguen siendo opcionales, pero deben configurarse juntas para exigir CAPTCHA.

Antes de publicar fuera del equipo se necesitan HTTPS, una base accesible desde el servidor y copias de seguridad. `127.0.0.1` en un hosting remoto se refiere a ese servidor, no a tu PC. Para producción configura `NEXT_PUBLIC_SITE_URL=https://...` para cookies Secure. Los encabezados de IP deben proceder de un proxy de confianza si se habilita acceso público. La recuperación de contraseña por correo no forma parte del flujo local actual.

## Verificación

`npm run check` ejecuta lint, tipos, validadores, contraseñas y SQL real compilado a WASM. `npm run test:e2e` comprueba el sitio sin configuración, en escritorio y móvil. `npm run test:local` crea una base temporal en PostgreSQL real, aplica migraciones y ejecuta los flujos privados y públicos desde el navegador; la elimina al terminar. Usa las credenciales administrativas del helper o `TEST_DATABASE_ADMIN_URL` para una instancia de pruebas. Nunca apunta las pruebas a la base de uso diario. En CI se utiliza un servicio PostgreSQL aislado.

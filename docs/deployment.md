# Conectar y desplegar InviteMe

## 1. Proyecto exclusivo de Supabase

Crear un proyecto llamado InviteMe en la organización elegida por el propietario. Antes de crearlo, revisar el coste y los límites del plan; no reutilizar las bases de Petshop ni questgame.

Para trabajar en local con Supabase se necesita Docker y se ejecuta `npx supabase start`. El CLI está fijado como dependencia de desarrollo. Para un proyecto remoto se usa `npx supabase login`, `npx supabase link --project-ref TU_PROJECT_REF` y `npx supabase db push`. Revisar los archivos de `supabase/migrations` antes de aplicarlos. No ejecutar un reset sobre producción.

Las migraciones crean eventos, respuestas, resumen de invitados, límites privados, RLS y bucket `covers` privado. Los tipos en `src/types/database.ts` son mantenidos manualmente a partir del esquema; una vez conectado, contrastarlos con `npx supabase gen types --linked --schema public`. Los tipos de dominio pueden moverse a un archivo separado si se adopta la generación automática.

## 2. Variables de entorno

Copiar `.env.example` a `.env.local` y completar:

| Variable                               | Uso                                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                 | URL completa de la app; localhost para desarrollo, dominio HTTPS para producción.                             |
| `NEXT_PUBLIC_SUPABASE_URL`             | URL del proyecto exclusivo.                                                                                   |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave pública habilitada.                                                                                     |
| `SUPABASE_SECRET_KEY`                  | Clave secreta solo del servidor; también admite la clave legacy service role si el entorno local la requiere. |
| `RSVP_RATE_LIMIT_SECRET`               | Secreto aleatorio de 32 caracteres como mínimo.                                                               |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`       | Opcional: clave pública CAPTCHA.                                                                              |
| `TURNSTILE_SECRET_KEY`                 | Opcional: clave secreta CAPTCHA. Configurar ambas o ninguna.                                                  |

Generar un secreto local con `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` y guardarlo únicamente en el entorno. Nunca pegar secretos en el chat, commits, capturas ni logs públicos.

Las claves `NEXT_PUBLIC_*` se incorporan al build: reconstruir cuando cambien. La landing y `/ejemplo` funcionan sin Supabase; el registro queda deshabilitado y la API de confirmaciones devuelve 503 hasta completar el entorno.

## 3. Autenticación y archivos

En Supabase Auth configurar Site URL y las URL de redirección permitidas (`http://localhost:3000/auth/confirm` y `https://TU_DOMINIO/auth/confirm`). Mantener confirmación de correo activada. La app admite el retorno PKCE con `code` y confirmación de tipo `signup` con `token_hash`; para confirmaciones desde otro navegador, configurar la plantilla de correo con `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup`.

Verificar el proveedor de correo antes de lanzar. El formulario de registro usa contraseñas de al menos 10 caracteres; establecer una política de contraseña acorde en Supabase.

Las portadas aceptan JPG, PNG y WebP de hasta 3 MB desde la app (el bucket tiene un tope absoluto de 5 MB). La firma binaria se valida en servidor; se rechaza SVG. No se optimizan imágenes mediante caché pública. Las URL firmadas caducan a los cinco minutos; una URL ya emitida puede seguir funcionando durante ese plazo al despublicar.

## 4. Vercel

Importar `JOL25/InviteMe`, seleccionar Next.js y Node.js 22, completar las variables por entorno y desplegar. En un dominio público configurar ambas claves de Turnstile y registrar el hostname en Cloudflare; el servidor valida hostname y acción `rsvp`.

El rate limiting persistente permite diez solicitudes por dirección en ventanas fijas de diez minutos. Solo se guarda un HMAC de la dirección y los registros caducados se eliminan al recibir nuevas solicitudes. Usuarios detrás de una misma IP comparten el límite. Si se aloja fuera de Vercel, configurar un proxy de confianza que sobrescriba `x-forwarded-for`; no exponer directamente un origen que acepte esa cabecera del cliente. El límite de tamaño del cuerpo JSON es 16 KiB.

La cuenta y el panel no deben almacenarse en caché compartida. La API de RSVP y las exportaciones llevan `no-store`; la invitación se resuelve dinámicamente y no publica nombres ni correos de asistentes. El slug es un enlace compartible, no una credencial administrativa; se marca `noindex` como preferencia para buscadores, sin considerarlo control de acceso.

## 5. Aceptación contra Supabase real

Las pruebas de `npm test` ejecutan SQL real en PGlite con fixtures de la plataforma. Las de `npm run test:e2e` comprueban las páginas públicas y el comportamiento sin credenciales en escritorio y móvil. No simulan un servicio de Auth ni prueban el flujo de cuenta conectado.

Antes de lanzar, completar estas verificaciones en un entorno de pruebas exclusivo:

1. Registrar dos cuentas, confirmar los correos y volver a iniciar sesión; comprobar refresco de sesión y cierre.
2. Crear un borrador con la primera cuenta. Su URL pública debe devolver 404; el dueño debe poder abrir la vista previa.
3. La segunda cuenta no puede leer, editar, borrar, descargar CSV ni cargar portadas del primer evento (404/403 o ninguna fila bajo RLS).
4. Subir y reemplazar una portada válida. Rechazar SVG, archivos de más de 3 MB y contenido con firma no admitida.
5. Publicar y escanear el QR desde otro dispositivo con el dominio HTTPS real.
6. En un evento con capacidad uno, enviar dos RSVP afirmativos simultáneos desde sesiones distintas con claves diferentes. Debe aceptarse uno; el otro recibe 409. Reintentar la respuesta aceptada debe devolver el mismo id sin duplicar filas.
7. Verificar que respuestas negativas no consumen cupos, que cerrar RSVP impide nuevas respuestas y que despublicar devuelve 404.
8. Confirmar filtros, resumen y exportación con más de mil respuestas. Probar nombres con comas, saltos, comillas y prefijos de fórmula.
9. Confirmar CAPTCHA real y 429 ante exceso de intentos. Probar fallos de red y reintentos.
10. Ejecutar los asesores de seguridad y rendimiento de Supabase; resolver advertencias aplicables y guardar el resultado en el registro de progreso.

## Estado de infraestructura

InviteMe está activo en `JOL25's Org`, región `sa-east-1`, referencia `djmxfvmfglllgaojntuf`. Se pausó `questgame` por indicación del propietario para liberar un cupo gratuito. Las dos migraciones están aplicadas; sus nombres de archivo coinciden con las versiones registradas en Supabase.

El entorno local está configurado en `.env.local` (excluido de Git), con clave pública, clave de servidor y secreto de rate limiting. Auth usa `http://localhost:3101` como Site URL y admite retornos exactos en `/auth/confirm` de localhost:3101 y localhost:3000. No se han enviado correos reales para las pruebas: se usaron cuentas desechables confirmadas mediante la API administrativa.

Se aprobaron 24 comprobaciones conectadas, incluida concurrencia real por HTTP, SSR, Storage y CSV paginado. También se verificó manualmente el flujo desde la interfaz. Consulta [el registro de verificación](supabase-verification.md). Siguen pendientes el despliegue público HTTPS, el correo real y CAPTCHA.

## Repetir las comprobaciones conectadas

Arrancar `npm run dev -- --port 3101` con las variables locales completas. En otra terminal PowerShell:

```powershell
$env:INVITEME_ALLOW_REMOTE_TESTS='1'
npm run test:connected
```

La prueba crea usuarios y eventos temporales en la base configurada y los elimina al finalizar; no usar este comando mientras se prueban límites de correo o CAPTCHA con claves reales. El origen HTTP de prueba debe ser local. Se usa una dirección reservada `192.0.2.x` en la cabecera del proxy local para aislar el límite de intentos; un despliegue público debe sobrescribir esa cabecera con su proxy de confianza.

`npm run test:e2e` reconstruye localmente las pruebas públicas con las variables del backend vacías, aunque exista `.env.local`. En CI se reutiliza la compilación hecha sin credenciales. Después de estas pruebas, ejecutar `npm run build` antes de iniciar una versión de producción local conectada; el servidor de desarrollo conserva su entorno.

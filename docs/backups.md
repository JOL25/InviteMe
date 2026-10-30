# Respaldo y recuperación local

Ejecuta los comandos desde la carpeta de InviteMe, con Node.js 22 y PostgreSQL 17. Arranca primero la instancia con `npm run db:start`. Si los binarios están en otra ubicación, configura `PG_BIN` con la carpeta que contiene `pg_dump` y `pg_restore` de la versión 17.

## Crear y comprobar

```powershell
npm run db:backup
npm run db:verify -- --backup "RUTA_COMPLETA_DEL_RESPALDO"
```

El primer comando crea una carpeta única dentro de `.local/backups`. Para elegir otra carpeta privada, usa `npm run db:backup -- --directory "D:\Respaldos\InviteMe"`. Dentro del repositorio solo se admite guardar bajo `.local`.

Conserva juntos sus tres archivos:

- `database.dump`: cuentas y hashes de contraseñas, eventos, invitados, respuestas, portadas, fotos, itinerarios y tablas privadas.
- `settings.json`: configuración seleccionada del sitio y secretos de enlaces, límites, correo y CAPTCHA. Conserva `INVITATION_LINK_SECRET` para reconstruir los mismos enlaces individuales.
- `manifest.json`: versión, migraciones, conteos de filas, tamaños y hashes SHA-256 de los dos archivos anteriores.

El respaldo usa la conexión del dueño de migraciones, desde `.env.database`, para incluir las tablas con RLS. El inventario y el archivo usan una misma instantánea consistente; se puede seguir usando la web mientras se crea. No incluye roles globales ni contraseñas de conexión de PostgreSQL, el buzón local, el código o dependencias.

`db:verify` comprueba los hashes, restaura todas las tablas en una base nueva, compara los conteos y verifica permisos. Después elimina exclusivamente esa base temporal y sus roles. No cambia la base activa. Si falla, conserva el respaldo y revisa la instalación de PostgreSQL 17, la conexión y los permisos del administrador.

## Restaurar una copia

```powershell
npm run db:restore -- --backup "RUTA_COMPLETA_DEL_RESPALDO"
# Opcional: elegir un nombre nuevo
npm run db:restore -- --backup "RUTA_COMPLETA_DEL_RESPALDO" --database inviteme_restore_prueba
```

El destino debe empezar por `inviteme_restore_`, seguido de 1 a 34 letras minúsculas, cifras o guiones bajos. Se rechazan bases o roles existentes. El comando crea dos roles nuevos con contraseñas aleatorias: dueño de migraciones y usuario restringido de aplicación. Restablece los permisos explícitos del proyecto, aplica migraciones pendientes compatibles y comprueba RLS. Se cierran las sesiones copiadas y se invalidan los enlaces de recuperación copiados; las contraseñas de las cuentas y los enlaces de invitados y gestión de RSVP se conservan.

Las conexiones nuevas se guardan en `.local/restores/NOMBRE/`: `runtime.json` para la web y `migration.json` para migraciones. No publiques ni compartas estos archivos. La conexión del dueño nunca debe llegar al proceso web. El comando no sustituye `.env.local`, `.env.database` ni la base de uso diario.

Para comprobar visualmente la copia, detén con Ctrl+C cualquier `next dev` de este mismo proyecto; Next comparte el directorio de desarrollo. Ejecuta:

```powershell
npm run db:preview -- --restore ".local/restores/NOMBRE"
```

Abre la dirección que imprime el comando, en el puerto 3103 por defecto; admite `--port 3104`. Inicia sesión con una cuenta y contraseña del respaldo. La vista usa otro hostname local, entrega de recuperación al buzón de esa copia y CAPTCHA desactivado. Las credenciales SMTP se deshabilitan en esta vista para evitar envíos externos. Ctrl+C detiene la vista; `npm run dev -- --port 3101` vuelve a la base habitual. Restaurar y previsualizar no activan automáticamente la copia como base principal.

## Conservarlo o moverlo a otra PC

Copia la carpeta completa del respaldo a un lugar privado fuera del equipo. Una copia en el mismo disco no protege de perder ese disco. Los archivos no están cifrados ni firmados: contienen información personal y secretos. Protégelos con los permisos y el cifrado del almacenamiento que uses; no los subas a Git ni a una carpeta pública. Los hashes detectan corrupción, pero no autentican quién creó el archivo. Restaura únicamente respaldos propios de confianza, porque un archivo PostgreSQL puede ejecutar SQL al restaurarse.

En otra PC, instala Node.js 22 y PostgreSQL 17, descarga el proyecto y ejecuta `npm ci` y `npm run db:start`. Copia el respaldo privado y ejecuta `db:verify`, `db:restore` y `db:preview` como arriba. Se crean credenciales nuevas de conexión; no necesitas trasladar las antiguas. Usa esta versión del código o una posterior compatible con sus migraciones. La URL del sitio debe actualizarse si cambia el dominio o puerto: los tokens se conservan, pero los enlaces que apuntan a otro equipo no se redirigen solos.

Si usas una instancia distinta del helper, configura `BACKUP_ADMIN_URL` en el entorno del comando o en `.env.database`, con conexión a la base administrativa `postgres`. Necesita permisos para crear y eliminar bases y roles. No la configures en el proceso web. El helper obtiene su administrador de `.local/postgres-credentials.json`; las pruebas también admiten `TEST_DATABASE_ADMIN_URL` para una instancia aislada.

Los respaldos son manuales: no hay programación ni eliminación automática de copias antiguas. Comprueba cada copia importante con `db:verify` y guarda también la versión del código usada.

Referencias: [pg_dump de PostgreSQL 17](https://www.postgresql.org/docs/17/app-pgdump.html) y [pg_restore de PostgreSQL 17](https://www.postgresql.org/docs/17/app-pgrestore.html).

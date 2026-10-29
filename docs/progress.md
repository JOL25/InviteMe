# Progreso

## 01 · Base

Next.js App Router, TypeScript estricto, Tailwind, ESLint, Prettier, comandos de comprobación y ejemplo de entorno sin secretos.

Comprobado: ESLint, TypeScript y compilación de producción. Dependencias fijadas a versiones compatibles con Next.js. `npm audit --omit=dev`: sin vulnerabilidades de producción; el auditor señala cinco avisos derivados de `braces` en las herramientas de lint, sin arreglo compatible propuesto. No se fuerza una regresión de Next.js para ocultarlos.

## Fases implementadas en código

1. Datos, permisos, validadores y pruebas de SQL.
2. Autenticación y gestión de eventos.
3. Diseño, invitación pública, portada y QR.
4. RSVP, panel y CSV.
5. Pruebas integradas, CI y guía de despliegue.

## 02 · Datos y reglas de negocio

Migración con RLS, bucket privado, función RSVP exclusiva para servidor, rate limiting persistente, idempotencia y bloqueo del evento. Validación de fechas, zonas, cupos y enlaces HTTPS. Tipos TypeScript alineados con el esquema.

Comprobado: ESLint, TypeScript y 26 pruebas (16 de validación y 10 sobre PostgreSQL/PGlite). Las pruebas ejecutan la migración y comprueban RLS, Storage, cupos, reintentos, cierre, borradores y rate limiting. PGlite no sustituye una prueba de concurrencia con varias conexiones contra Supabase.

## 03 · Autenticación

Registro, login, confirmación de correo, cierre de sesión y refresco SSR. Verificación de identidad en servidor. Pantallas adaptables con estados de error y de servicio pendiente de configuración.

Comprobado: ESLint, TypeScript, 26 pruebas y compilación de producción. Prueba real de correo y sesión pendiente de conectar el proyecto exclusivo de Supabase.

## 04 · Eventos

Panel con búsqueda y paginación, creación/edición, borradores, publicación, cierre de RSVP y eliminación con confirmación. Datos y tema se guardan juntos. Los cupos no se pueden reducir por debajo de los confirmados.

Comprobado: ESLint, TypeScript, 26 pruebas y compilación de producción. Flujo autenticado contra Supabase pendiente de conexión.

## 05 · Landing y dirección visual

Landing editorial en marfil, azul noche y rosa; ilustración botánica SVG local, muestra de invitación, beneficios, pasos y FAQ accesible con elementos nativos. Diseño adaptable sin fuentes ni fotografías externas.

Comprobado: compilación de producción, revisión visual de capturas de escritorio/móvil y pruebas de navegación y desbordamiento.

## 06 · Invitación y RSVP

Invitación pública con proyección explícita de campos, noindex, fecha en la zona del evento, cuenta regresiva, mapa y formulario. Vista previa privada y muestra sin envíos. Portadas privadas, controles de formato y tamaño, colores con contraste validado. API con cuerpo limitado, validación de origen, CAPTCHA opcional y llamada exclusiva desde servidor a la función transaccional.

Comprobado: ESLint, TypeScript, compilación de producción y pruebas locales. Validación conectada de CAPTCHA, Auth y Storage pendiente de Supabase real.

## 07 · Respuestas, CSV y QR

Resumen agregado con RLS, lista paginada y filtros de asistencia. Exportación autorizada desde servidor con paginación para evitar el límite de mil registros, UTF-8 y neutralización de fórmulas. Enlace copiable y QR descargable solo de eventos publicados.

Comprobado: ESLint, TypeScript, compilación y 39 pruebas de unidades/base de datos. El resumen de un evento ajeno devuelve cero filas de datos sensibles. Pruebas de escaneo QR y descarga CSV contra el dominio real pendientes de infraestructura.

## 08 · Verificación y entrega

GitHub Actions ejecuta formato, lint, TypeScript, 39 pruebas de unidades/PostgreSQL, auditoría de producción, build y 12 pruebas de navegador. Las pruebas de navegador cubren escritorio/móvil, anchos de 320 px, navegación, formulario de muestra sin envíos, contador, rechazo de acceso al panel sin configuración y validación inicial de la API. Capturas revisadas localmente.

La guía de despliegue enumera las comprobaciones conectadas pendientes y explica variables, migraciones, correo, límites y permisos de portadas.

## 09 · Conexión real de Supabase

Se creó InviteMe en JOL25's Org tras pausar questgame con autorización del propietario. Se aplicaron las migraciones, se configuraron las claves exclusivamente en `.env.local` y las URL locales de Auth.

Pasaron 24 comprobaciones contra el servicio real: Auth, sesiones SSR, RLS, portadas privadas, publicación, dos solicitudes simultáneas al último cupo, idempotencia, cierre, despublicación, resumen y exportación de más de mil respuestas con autorización. Las cuentas y datos temporales se eliminaron.

Se comprobó en navegador iniciar sesión, crear borrador, publicar, generar QR, confirmar asistencia, consultar respuestas y descargar un CSV con 1001 filas de datos. Se corrigió una omisión en CSV por diferencias de precisión/reloj: ahora la exportación toma el límite desde los datos de PostgreSQL. La prueba conectada reproduce este caso con una fecha adelantada.

Asesores: ningún aviso de rendimiento; un aviso informativo de RLS sin políticas en `private.rsvp_limits`, intencionado porque solo el backend accede con `service_role` y no se concede uso del esquema a usuarios públicos.

### Pendiente para producción

- Despliegue en dominio HTTPS y traslado de las variables al entorno de hosting.
- Configuración y prueba de correo real para confirmar registros (las pruebas de Auth no envían correo).
- Configuración y prueba de CAPTCHA real.
- Escaneo del QR desde otro dispositivo contra el dominio público y aceptación final.

## 10 · Animaciones

Entradas escalonadas en el hero, aparición de la tarjeta de invitación y elementos decorativos, revelado de secciones al desplazarse y efectos de interacción en botones, tarjetas, FAQ y campos. Las entradas son finitas y se ejecutan una vez; no hay bucles decorativos continuos ni bibliotecas nuevas.

`ScrollReveal` mantiene visible el HTML del servidor y solo prepara elementos fuera del viewport después de hidratar. El contenido sigue disponible sin JavaScript o sin IntersectionObserver. La opción del sistema de movimiento reducido elimina las animaciones y descubre inmediatamente cualquier sección pendiente; foco y enlaces de ancla tampoco esperan al revelado.

Comprobado: ESLint, TypeScript, 39 pruebas de unidades/SQL y 18 pruebas de navegador en escritorio y móvil. Las seis comprobaciones nuevas cubren revelado, cambio de preferencia en caliente, llegada al RSVP y contenido sin JavaScript.

La revisión visual incluyó el panel lateral y los anchos de 320, 714 y 820 px. El hero pasa a una columna en ventanas intermedias y su círculo decorativo se ajusta al espacio disponible; el control de desbordamiento compara con el ancho real del contenido, descontando la barra de desplazamiento.

## 11. PostgreSQL local — esquema y contraseñas (29/10/2026)

A petición del propietario se reemplaza Supabase por una base local nueva y vacía. Supabase permanece pausado; no se importan sus datos. Esquema independiente en `database/migrations/`: usuarios, sesiones, eventos, respuestas, portadas bytea y límites de intentos. Se conserva el bloqueo transaccional del evento para RSVP, idempotencia y validación de capacidad. Contraseñas con scrypt, sal aleatoria y comparación de tiempo constante.

Comprobación de esta etapa: 34 pruebas unitarias/SQL aprobadas; migración aplicada y repetida sin cambios en PostgreSQL 17 local. El flujo conectado de aplicación se verifica en la siguiente etapa.

## 12. Aplicación conectada a PostgreSQL local (29/10/2026)

Se reemplazan los clientes de Supabase por un pool `pg` exclusivo del servidor y consultas parametrizadas con filtro de propietario. Registro e inicio de sesión locales, sesiones revocables de siete días, cookies HttpOnly/SameSite, límites persistentes de autenticación y portadas bytea con acceso por publicación/propiedad. Eventos, publicación, vista previa, respuestas, resumen y CSV usan la base local. Se eliminan las dependencias de Supabase del runtime y el script de verificación obsoleto. Se añaden arranque/parada de una instancia exclusiva y migraciones transaccionales con checksum independiente de saltos de línea.

Verificado: lint, TypeScript, 34 pruebas unitarias/SQL, build de producción y dos escenarios completos de navegador contra PostgreSQL 17 real con un rol sin superusuario. Incluyen aislamiento de dos propietarios, intento de actualización con ID manipulado, portadas privadas y despublicación, cupos concurrentes, idempotencia, CSV de 1003 respuestas, borrado en cascada, logout, login, expiración, cuentas duplicadas y límites de autenticación. Arranque, parada y reinicio local comprobados. La base de uso diario conserva cero cuentas, eventos y respuestas; los datos de prueba se eliminan con su base temporal.

## 13. Pruebas repetibles y guía local (29/10/2026)

Se automatizan los dos escenarios conectados en `npm run test:local`: base y rol temporales, migraciones, build, navegador y limpieza incluso tras un fallo. Se integra un servicio PostgreSQL 17 en CI. Documentación actualizada para configuración, sesiones, portadas, arranque/parada, respaldo y límites de despliegue. La verificación de Supabase queda identificada como histórica.

Resultado final local: formato correcto; lint y tipos aprobados; 34 pruebas unitarias/SQL, 18 pruebas públicas de escritorio/móvil y 2 escenarios completos conectados aprobados (54 pruebas en total); compilación de producción correcta y `npm audit --omit=dev` sin vulnerabilidades. La instancia local se detuvo y reinició conservando el esquema, sin tocar PostgreSQL de otros proyectos. La base de uso diario quedó vacía y el usuario de aplicación no es superusuario.

Se normalizaron los saltos de línea de `.env.example` para evitar caracteres CR duplicados en Windows. Verificación: `git diff --check` y comprobación de formato.

## 14. RLS y rol restringido (29/10/2026)

Migración aditiva `002_runtime_rls.sql`: RLS en eventos, respuestas y portadas; tablas de cuentas, sesiones, límites y migraciones sin acceso directo del runtime. Rol `inviteme_runtime` separado del dueño `inviteme_app`, sin superusuario, BYPASSRLS ni pertenencia al dueño. La web rechaza una conexión que eluda RLS. Cada consulta privada configura identidad autenticada mediante SET LOCAL dentro de una transacción; COMMIT y ROLLBACK limpian el contexto del pool. Las funciones privilegiadas de autenticación, lectura pública y RSVP tienen search_path vacío, nombres cualificados y permisos enumerados. Las credenciales de migración quedan en `.env.database`, fuera de las variables que carga Next.js.

Verificado: 41 pruebas unitarias/SQL, incluidas siete nuevas pruebas de RLS sin filtros de propietario. Tres escenarios conectados aprobados con PostgreSQL 17: flujo completo existente, errores/límites de autenticación y comprobación directa de RLS y limpieza de contexto tras éxito y error. La base de uso diario se actualizó sin borrar datos. El propietario prefiere seguir probando en su PC; publicación HTTPS aplazada.

## 15. Movimiento visible y elección del visitante (29/10/2026)

Entradas progresivas del título desde izquierda/derecha, aparición de la tarjeta y sus notas, revelado lateral escalonado al desplazarse, respuesta de pulsación y onda temporal en botones/FAQ. Controles visibles para activar/desactivar y repetir la entrada; preferencia persistida en el navegador, respetando movimiento reducido cuando no existe elección explícita. Repetir no remonta la página ni reinicia formularios. Se evita el salto de enlaces/FAQ al enfocarlos con el ratón; el foco de teclado sigue mostrando el contenido inmediatamente. Sin dependencias nuevas ni animaciones infinitas.

Comprobado: build, lint, tipos, 41 pruebas unitarias/SQL y 24 pruebas de escritorio/móvil. Se observó movimiento real en el navegador del usuario con prefers-reduced-motion activo: líneas con opacidades y desplazamientos distintos y sin desbordamiento horizontal. Se dejó la preferencia activada en la vista local.

## 16. Aceptación local de RLS y movimiento (29/10/2026)

Se amplían las pruebas de navegador para activar movimiento explícito con la preferencia del sistema reducida, comprobar desplazamientos reales/opacidad, repetir la entrada conservando lo escrito en RSVP, persistir la elección y manejar el control con teclado. Se comprueba la onda temporal y la apertura nativa de FAQ. La prueba conectada ahora envía el formulario RSVP desde la invitación, comprueba la pantalla de agradecimiento, verifica el enlace compartible y descarga el QR, además de los controles previos de cupos, permisos y CSV.

Resultado: 41 pruebas unitarias/SQL, 24 pruebas públicas de escritorio/móvil y 3 escenarios conectados en PostgreSQL 17 real: 68 aprobadas. Formato, lint, tipos y compilación aprobados. Revisión visual en el navegador local sin desbordamiento ni errores de consola. Por elección del propietario, no se publica el sitio ni se expone PostgreSQL fuera del equipo; la prueba de QR desde otro dispositivo contra un dominio HTTPS sigue aplazada con esa publicación. La prueba de QR actual valida la descarga y el enlace local.

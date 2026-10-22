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

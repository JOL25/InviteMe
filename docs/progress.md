# Progreso

## 01 · Base

Next.js App Router, TypeScript estricto, Tailwind, ESLint, Prettier, comandos de comprobación y ejemplo de entorno sin secretos.

Comprobado: ESLint, TypeScript y compilación de producción. Dependencias fijadas a versiones compatibles con Next.js. `npm audit --omit=dev`: sin vulnerabilidades de producción; el auditor señala cinco avisos derivados de `braces` en las herramientas de lint, sin arreglo compatible propuesto. No se fuerza una regresión de Next.js para ocultarlos.

## Próximas entregas

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

# Verificación de Supabase · 22 de octubre de 2026

Proyecto [InviteMe](https://supabase.com/dashboard/project/djmxfvmfglllgaojntuf), organización JOL25's Org, región São Paulo. Plan gratuito, coste de creación cotizado en USD 0/mes. `questgame` quedó pausado a petición del propietario; `Petshop-Backend` no se utilizó para InviteMe.

## Esquema y acceso

Migraciones `20261022191643_initial_inviteme` y `20261022191646_guest_summary` aplicadas y alineadas con los archivos locales. Bucket `covers` privado. Las claves están únicamente en el entorno local ignorado por Git.

Una transacción de comprobación real verificó aislamiento entre propietarios, bloqueo de lectura anónima, inaccesibilidad del esquema privado, inserción RSVP, idempotencia y capacidad. Todos sus datos fueron revertidos.

## Comprobación automatizada conectada

`npm run test:connected` aprobó 24 comprobaciones con dos cuentas desechables y la API local conectada a Supabase real. Incluye login por contraseña, cookies SSR, CRUD bajo RLS, Storage, publicación, RSVP simultáneos para el último cupo, reintentos y resumen. La exportación autentica al propietario, rechaza otro propietario y usuarios anónimos y entrega 1002 respuestas más cabecera.

Una fila de la prueba tiene una fecha de creación un minuto adelantada respecto al reloj local. Antes de la corrección se omitía; ahora se incluye porque el límite de exportación usa el último timestamp de la base, conservando su precisión. Un evento sin respuestas devuelve solo la cabecera del CSV.

La prueba usa la API administrativa para crear cuentas temporales ya confirmadas. Esto verifica autenticación real, pero no entrega de correo. Los registros y cuentas se borran al finalizar mediante sus identificadores exactos; las sesiones de prueba se cierran antes de eliminar usuarios.

## Comprobación manual de interfaz

Se inició sesión en el navegador con una cuenta temporal, se creó un borrador con fecha y zona de Lima, se publicó la invitación y se abrió su enlace público. Se envió un RSVP mediante el formulario, apareció en el panel y se mostró el mensaje de confirmación. El panel generó el QR del enlace local.

Se añadieron 1000 respuestas negativas temporales y se descargó el CSV autenticado: 1001 respuestas completas, seis columnas por fila, tildes, comillas y saltos de línea conservados; un nombre que comenzaba con `=SUM` se exportó como texto seguro. Al terminar se cerró sesión y se borraron el evento y la cuenta temporal. La consulta de limpieza devolvió cero eventos, cero RSVP y cero usuarios temporales.

## Asesores

- Rendimiento: sin avisos después de las pruebas.
- Seguridad: aviso informativo [RLS Enabled No Policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) para `private.rsvp_limits`. Es intencional: RLS bloquea todo acceso ordinario; `anon` y `authenticated` no tienen uso del esquema, y `service_role` accede desde el servidor. No se añade una política pública para silenciarlo.

## Pendiente

Correo real, CAPTCHA y despliegue HTTPS. No se ha realizado una prueba de entrega de correo ni escaneo desde otro dispositivo en un dominio público.

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

## 17. Datos y permisos de la galería (29/10/2026)

Se retoma el siguiente pendiente del PDF manteniendo la ejecución local: galería de hasta ocho imágenes por evento. Migración aditiva `003_event_gallery.sql`, fotos bytea de hasta 3 MB, JPG/PNG/WebP, descripción obligatoria y pie opcional de hasta 180 caracteres. Las ocho posiciones únicas limitan también la base de datos. RLS por propietario, identidad de foto inmutable, borrado en cascada y funciones públicas con proyección de metadatos y lectura de bytes condicionada a publicación o propiedad. Permisos del runtime enumerados explícitamente.

Verificado: migración aplicada en PostgreSQL 17 local sin borrar datos; lint, tipos y 50 pruebas unitarias/SQL aprobadas. Nueve pruebas nuevas cubren validación de textos, límite de fotos, inmutabilidad, proyección pública y aislamiento de propietarios. La interfaz y las comprobaciones conectadas se completan en la siguiente etapa.

## 18. Editor y visor de galería (29/10/2026)

Editor privado para subir fotos, modificar descripción/pie, cambiar orden y eliminar con confirmación. Persistencia y reordenación transaccionales bajo RLS; la inserción/borrado compacta posiciones, y el intercambio usa la restricción única diferida y tipos enteros explícitos. Vista previa y página publicada incluyen la misma galería. Visor nativo dialog con botones, flechas, Escape y devolución del foco; miniaturas visibles sin JavaScript y composición responsive, centrando galerías de una o dos fotos. La invitación no muestra una sección vacía cuando no hay imágenes.

Verificado: 50 pruebas unitarias/SQL y prueba de navegador contra PostgreSQL 17 real con carga válida/errónea, tamaño máximo, edición, orden, privacidad, intento de otro propietario, publicación, despublicación, borrado en cascada y dos subidas simultáneas al último espacio. Visor y ausencia de desbordamiento verificados a 320, 714 y 1280 px; galería visible sin JavaScript. Captura revisada con imágenes de prueba generadas localmente. Las tres pruebas conectadas anteriores también aprobaron con la nueva migración.

## 19. Verificación conectada de galería (29/10/2026)

Se añade una prueba completa de navegador: rechaza SVG y archivos de más de 3 MB; comprueba bytes/MIME de un PNG generado localmente; sube, reordena y edita; abre/cierra el visor con teclado y restaura el foco; bloquea lecturas y escrituras ajenas; comprueba las vistas publicadas en tres anchos y sin JavaScript; envía dos subidas simultáneas al último espacio y exige que una sea rechazada; elimina, reutiliza el espacio, despublica y comprueba el borrado en cascada. El runner acepta un archivo o filtro para repetir una comprobación concreta.

Comprobaciones locales: 50 pruebas unitarias/SQL y 24 pruebas públicas de escritorio/móvil aprobadas; el nuevo recorrido conectado de galería aprobado, junto a los tres recorridos existentes que también aprobaron con el nuevo esquema. Build, lint, tipos y formato correctos. Fotos y cuentas de prueba se crean en una base temporal y se eliminan; no se añaden imágenes de demostración ni usuarios a la base de uso diario. Frontend local reanudado en el puerto 3101. Publicación HTTPS sigue aplazada. Siguiente pendiente funcional: padrón de invitados con enlaces nominativos y conteo fiable de respuestas pendientes.

## 20. Invitaciones individuales y pendientes (29/10/2026)

Migración aditiva `004_named_invitations.sql`: lista privada por evento con nombre, contacto opcional, cupo individual y enlaces renovables/desactivables. RLS, identidad inmutable, una respuesta por invitación y relación compuesta que evita asociarla a otro evento. Las mutaciones y respuestas bloquean la fila del evento, compartiendo capacidad con los RSVP abiertos. Se conservan las respuestas al renovar o desactivar; los invitados que ya respondieron no se editan ni eliminan. El borrado del evento mantiene la cascada completa.

Panel paginado con filtros y resumen de total, pendientes, confirmaron y no asistirán. Los pendientes cuentan invitaciones sin respuesta individual, incluso con enlace desactivado; las respuestas abiertas nunca se asocian por nombre/correo y aparecen identificadas en panel y CSV. El token se reconstruye mediante HMAC y un secreto estable del servidor, se almacena solo como hash y se comparte en el fragmento del enlace. El formulario lo resuelve mediante POST, muestra únicamente el nombre/cupo/estado de esa invitación, conserva el fragmento al ir al RSVP y bloquea enlaces inválidos sin convertirlos en respuestas abiertas. No se automatiza mensajería.

Verificado: lint, tipos y formato; 66 pruebas unitarias/SQL, 24 pruebas públicas de escritorio/móvil y siete recorridos conectados con PostgreSQL 17 real: 97 pruebas aprobadas. Los tres recorridos nuevos comprueban enlaces estables y sin secretos en URLs de API, cupos, respuesta única, pendientes con nombres coincidentes, renovación, desactivación, eliminación de pendientes, CSV, aislamiento de propietarios con ID manipulado y dos confirmaciones simultáneas al último cupo. Sin desbordamiento en el panel a 320, 714 y 1280 px. Migración aplicada a la base local sin borrar datos; las cuentas y eventos de pruebas se eliminan con su base temporal. Se mantiene la ejecución local y Supabase pausado.

## 21. Datos del itinerario (29/10/2026)

Migración aditiva `005_event_itinerary.sql`: actividades con título, fecha/hora absoluta, descripción y lugar opcionales. Índice por evento y fecha, orden cronológico estable, RLS por propietario, identidad inmutable, límite de 20 actividades con bloqueo del evento y borrado en cascada. Proyección pública de campos explícitos, disponible solo mientras el evento esté publicado. La hora local se interpreta usando la zona del evento; se rechazan fechas inexistentes, incluyendo el salto de horario de verano. Las actividades pueden extenderse a días posteriores.

Comprobado: migración aplicada en PostgreSQL 17 local sin borrar datos; lint, tipos y 78 pruebas unitarias/SQL aprobadas. Las 12 pruebas nuevas cubren conversiones, validación, RLS sin filtros, escritura ajena, límite y reutilización de espacio, proyección pública, orden y cascada. La interfaz y los recorridos conectados se verifican en la siguiente etapa.

## 22. Editor y presentación del itinerario (29/10/2026)

Editor en Detalles y diseño, con acceso directo desde la pestaña Itinerario. Permite añadir, editar y eliminar actividades con confirmación, mostrando cupo y zona horaria. Conversión y permisos comprobados en servidor bajo bloqueo del evento; consultas parametrizadas y transacciones con contexto de propietario. La vista previa privada y la invitación publicada comparten la misma presentación cronológica, con fecha, hora, lugar y descripción. Las actividades se revelan al desplazarse y permanecen disponibles sin JavaScript; sin actividades no aparece una sección vacía.

Verificado: 78 pruebas unitarias/SQL y nueve recorridos conectados con PostgreSQL 17 real aprobados; incluyen edición, orden, actividades de varios días, conversión a UTC, privacidad de borradores, publicación y despublicación, texto escapado, vista sin JavaScript, eliminación, límite concurrente, reutilización de espacio, aislamiento con ID manipulado y borrado en cascada. Captura de la sección revisada; sin desbordamiento a 320, 714 y 1280 px. Las pruebas públicas y la verificación final se registran en la siguiente etapa.

## 23. Verificación final del itinerario (29/10/2026)

Se incorporan dos recorridos repetibles de navegador en `tests/local/itinerary.spec.ts`, con cuentas y eventos temporales y limpieza aislada. El primero cubre la ausencia de sección vacía, altas fuera de orden, edición hacia el día siguiente, conversión a UTC, vista previa, publicación/despublicación y presentación pública sin JavaScript. El segundo llena 19 espacios, envía desde dos pestañas al último espacio y exige un único rechazo, prueba aislamiento con ID manipulado, elimina y reutiliza espacio y verifica la cascada del evento.

Resultado local: 78 pruebas unitarias/SQL, 24 públicas de escritorio/móvil y nueve recorridos conectados: 111 pruebas aprobadas. Formato, lint, tipos y compilación correctos. Captura del itinerario revisada y anchos de 320, 714 y 1280 px comprobados. El frontend responde en el puerto 3101 y la migración se aplicó a la instancia local. Supabase sigue pausado y la publicación HTTPS permanece aplazada por elección del propietario.

## 24. Gestión transaccional de respuestas (30/10/2026)

Migración aditiva `006_rsvp_management.sql`: hash de capacidad privada para respuestas abiertas nuevas, versión, fecha de actualización y marca de cancelación. La asignación del hash solo ocurre al crear la respuesta; los reintentos no pueden reclamar respuestas previas ni cambiar su enlace. Los invitados nominativos reutilizan su enlace individual vigente, sujeto a revocación/renovación y publicación. Proyección acotada de la respuesta autorizada, sin contacto privado de la lista. Las ediciones respetan cupo individual, capacidad global y cierre de RSVP; el cálculo excluye la reserva anterior. Cancelar libera cupos, conserva la respuesta y no incrementa pendientes; se permite con RSVP cerrado. Control de versión contra sobrescrituras desde pestañas antiguas y límite persistente de intentos compartido.

Verificado: migración aplicada en PostgreSQL 17 local sin borrar datos; lint, tipos y 90 pruebas unitarias/SQL aprobadas. Las 12 nuevas cubren capacidades, no apropiación por reintentos, versiones, capacidad, cuota individual, nombre nominativo inmutable, cancelación/reconfirmación, cierre, revocación, publicación, validación y prohibición de escritura directa del runtime. La interfaz y los recorridos conectados se comprueban en la siguiente etapa.

## 25. Formulario privado de gestión (30/10/2026)

Pantalla `/i/[slug]/manage` con resolución de capacidad por POST, sin datos privados en el HTML inicial. El agradecimiento ofrece el enlace privado de gestión; los enlaces nominativos ya respondidos lo muestran también. Las nuevas respuestas abiertas generan el token antes de enviar y lo conservan en reintentos; si sessionStorage está bloqueado, el enlace se conserva en el fragmento del agradecimiento. Formulario para asistencia, acompañantes, correo, mensaje y nombre solo en respuestas abiertas; cancelación con confirmación, recarga explícita de datos y copia del enlace. El guard compartido conserva las verificaciones existentes de configuración, CAPTCHA e IP. Panel y CSV distinguen cancelaciones.

Verificado: los nueve recorridos conectados anteriores siguen aprobados con el nuevo esquema y código; los tres nuevos recorridos de gestión también aprobaron contra PostgreSQL 17 real. Se comprobaron versiones antiguas, cupos simultáneos, cierre/cancelación, reconfirmación, renovación, privacidad del HTML, hashes almacenados, tokens fuera de URLs de API y almacenamiento bloqueado. Captura revisada y anchos de 320, 714 y 1280 px sin desbordamiento. Las pruebas públicas y el cierre se registran en la siguiente etapa.

## 26. Verificación final de edición y cancelación (30/10/2026)

Tres recorridos repetibles en `tests/local/rsvp-management.spec.ts`: respuesta abierta con enlace privado, edición y pestaña antigua; cancelación con RSVP cerrado, CSV y reconfirmación; invitado nominativo con cupo/nombre conservados, renovación y conteos; dos ampliaciones simultáneas sobre el mismo cupo global; y recepción del enlace aun con sessionStorage bloqueado. Las pruebas usan cuentas y bases temporales y comprueban hashes y resultados directamente en PostgreSQL. Se ajustaron selectores de asistencia y la recarga al comprobar una capacidad renovada, sin alterar las reglas de autorización.

Resultado: 90 pruebas unitarias/SQL, 24 públicas de escritorio/móvil y 12 recorridos conectados aprobados: 126 pruebas. Los nueve recorridos conectados existentes aprobaron en la suite completa; los tres nuevos aprobaron en su repetición específica después de corregir las pruebas. Formato, lint, tipos y compilación correctos. Captura de la gestión revisada y anchos de 320, 714 y 1280 px comprobados. El frontend sigue respondiendo en el puerto 3101; Supabase permanece pausado y no se publica el sitio fuera del equipo. Las respuestas abiertas anteriores sin capacidad privada se conservan y no pueden reclamar un enlace por datos personales o claves de reintento.

## 27. Recuperación y sesiones bajo bloqueo (30/10/2026)

Migraciones aditivas `007_password_recovery.sql` y `008_recovery_issuance_variable.sql`: token privado de recuperación, límites por correo/IP, vencimiento de 30 minutos, sustitución del enlace anterior y consumo único. La segunda corrige un nombre ambiguo conservando la migración aplicada. Cambiar la contraseña revoca todas las sesiones y enlaces de esa cuenta. Apertura de sesión condicionada al hash previamente verificado, bajo el mismo bloqueo de usuario: una verificación antigua no sobrevive al cambio. Se retira al runtime el permiso de la función anterior de apertura sin comprobación.

Buzón local en `.local/mail`, fuera de Git y del paquete de servidor. Entrega habilitada solo por configuración explícita y URL de loopback; sin envío externo. Mensajes creados con nombre aleatorio, escritura temporal y renombrado; limpieza de caducados y CLI con filtro de destinatario. Las rutas de archivos se validan dentro de `.local`; el acceso dinámico se excluye explícitamente del análisis de Turbopack, evitando que recorra el proyecto. La configuración de empaquetado excluye `.local` y `.env*`. Se limitan a cuatro los workers unitarios y se amplía a 30 segundos la inicialización de cada base WASM; los límites de las pruebas funcionales se mantienen.

Verificado: lint, tipos y 103 pruebas unitarias/SQL aprobadas. Las 13 nuevas comprueban validación, confirmación, modo local, ruta de buzón, mensajes caducados/malformados, RLS, límites, sustitución, consumo, expiración, cierre de sesiones, autenticación pendiente y cascada. Migraciones aplicadas a PostgreSQL 17 local sin borrar datos. Los recorridos de navegador se verifican en la siguiente etapa.

## 28. Solicitud y formulario de recuperación local (30/10/2026)

Acceso desde Olvidé mi contraseña, solicitud con respuesta genérica y espera mínima común de 300 ms, enlace con token en fragmento y formulario con confirmación de contraseña. Las API controlan origen, tamaño/JSON, límites y disponibilidad; no devuelven enlaces ni datos de la cuenta. Los botones esperan a que JavaScript esté listo para evitar envíos nativos antes de hidratar. Visitar el enlace no lo consume; al cambiar la contraseña se ofrece iniciar sesión y se guarda un aviso sin contraseña en el buzón local. La documentación explica el comando de consulta y que el envío por correo real sigue pendiente.

Verificado: los 15 recorridos conectados aprobaron juntos con PostgreSQL 17 real. Los tres nuevos comprueban uso completo desde el navegador, CLI del buzón, hash del token, mensajes, confirmación coincidente, sesiones revocadas, contraseña anterior rechazada, conservación del evento, no enumeración, límites, caducidad/sustitución, dos consumos simultáneos y login pendiente. Se comprueba que el HTML y las URLs de API no revelen el token y que las trazas del paquete no incluyan `.local` ni `.env`. Captura de la nueva contraseña revisada y anchos de 320, 714 y 1280 px sin desbordamiento. Se preserva la forma documentada de las anotaciones de Turbopack para excluir el acceso a archivos privados del análisis estático.

## 29. Verificación final de recuperación local (30/10/2026)

Tres recorridos repetibles en `tests/local/recovery.spec.ts`, con buzón y base temporales: cambio completo de contraseña conservando eventos y revocando dos sesiones; solicitud genérica, sustitución/caducidad y límites; consumo simultáneo con un único ganador y rechazo de login con el hash anterior. Se comprueban la CLI, el aviso de cambio, la falta de inicio automático, los datos de PostgreSQL y la exclusión de archivos privados del paquete. El formulario espera hidratación y las pruebas esperan la navegación antes de llenar campos comunes a login y recuperación.

Las pruebas de animación capturan la onda al insertarse y toman una muestra de la animación CSS en un instante controlado antes de reanudarla. Esto elimina carreras entre consultas separadas al navegador en equipos ocupados; se mantiene la comprobación de opacidad, desplazamiento, animación activa, repetición y conservación del formulario. La suite pública utiliza dos workers. No se modifica el comportamiento visual de la aplicación.

Resultado local: formato, lint, tipos y compilación correctos; 103 pruebas unitarias/SQL, 24 públicas y 15 recorridos conectados aprobados: 142 pruebas. Captura revisada y anchos de 320, 714 y 1280 px sin desbordamiento. La base diaria recibió las migraciones sin borrar datos; las cuentas, buzones y bases de prueba se eliminan al terminar. El flujo está listo para probar en este equipo mediante el buzón privado; el envío externo por correo continúa pendiente de proveedor y la publicación HTTPS sigue aplazada. Supabase permanece pausado.

## 30. Transporte SMTP preparado (30/10/2026)

El propietario aún no tiene proveedor y solicita dejar el soporte preparado. Se añade Nodemailer con versión fijada y configuración privada para host, puerto, usuario, contraseña y remitente. Producción exige credenciales, remitente único válido, HTTPS salvo pruebas del sitio en loopback, TLS implícito en 465 o STARTTLS obligatorio en otros puertos, certificados válidos y TLS 1.2 mínimo. Se desactivan el acceso a archivos/URLs desde el contenido y los registros del protocolo. El modo interno de captura sin TLS exige loopback tanto en la web como en el servidor SMTP.

Plantillas de texto y HTML para recuperación y aviso de cambio, con enlace canónico y token en fragmento; sin adjuntos ni recursos remotos. Despacho SMTP mediante `after` para desacoplar la respuesta de la latencia y el rechazo del proveedor; errores genéricos sin datos privados. El buzón local sigue siendo un modo explícito y no hay cambio automático de transporte ante errores. Nodemailer se mantiene como paquete externo de servidor.

Verificado: lint, tipos y 112 pruebas unitarias/SQL aprobadas. Las nueve nuevas cubren TLS, configuración incompleta, inyección de remitente, URLs manipuladas, loopback, plantillas y rechazo real de un servidor que no ofrece STARTTLS antes de transmitir el mensaje. Auditoría de dependencias de producción sin vulnerabilidades. La integración de API y los recorridos de captura se registran en la siguiente etapa.

## 31. Recuperación conectada a SMTP (30/10/2026)

Las rutas de solicitud y cambio de contraseña seleccionan el transporte configurado. En modo SMTP el envío queda programado después de responder; el resultado no revela si existe la cuenta ni si el servidor aceptó el mensaje. La página muestra instrucciones del buzón solo en modo local y una configuración SMTP incompleta no habilita el formulario. Se documentan variables privadas, cifrado, remitente autorizado, uso en localhost, errores y la ausencia de cola persistente/reintentos automáticos. La activación real sigue aplazada por elección del propietario, que aún no tiene proveedor.

Verificado: los 15 recorridos conectados existentes aprobaron con PostgreSQL 17, conservando el buzón local y las funciones previas. Dos recorridos adicionales con un servidor SMTP de captura en loopback aprobaron: reciben y analizan los mensajes MIME de enlace y aviso, comprueban hashes y cierre de sesiones, bloquean temporalmente SMTP sin bloquear la respuesta HTTP, simulan rechazo y recuperan la entrega tras corregirlo. Ningún mensaje sale a Internet. Los datos de pruebas se aíslan en otra base y otro directorio. Las pruebas públicas y la incorporación del runner a CI se registran en la siguiente etapa.

## 32. Verificación SMTP aislada y CI (30/10/2026)

Nuevo comando `npm run test:smtp`, con configuración Playwright separada, PostgreSQL temporal y SMTP de captura que solo escucha en 127.0.0.1 con puerto aleatorio. El servidor conserva los mensajes de prueba en un directorio privado temporal, admite una espera controlada y rechazo por destinatario y no reenvía a Internet. Los recorridos comprueban recepción MIME del enlace y del aviso, contenido de texto/HTML, hashes, ausencia de secretos en la web, revocación de sesiones y respuesta común ante demora, rechazo o cuenta desconocida. CI ejecuta este comando además de las suites anteriores.

Resultado local: 112 pruebas unitarias/SQL, 24 públicas de escritorio/móvil, 15 recorridos con PostgreSQL en modo local y dos con SMTP de captura: 153 pruebas aprobadas. Formato, lint, tipos y compilaciones correctos; auditoría de producción sin vulnerabilidades. El modo de uso diario permanece local, sin credenciales SMTP configuradas ni envío externo activado. El soporte está preparado y documentado; falta elegir proveedor, configurar remitente y credenciales y verificar la entrega externa cuando el propietario decida activarla. Sin cambios de esquema ni reactivación de Supabase.

## 33. Motor de respaldo y restauración (30/10/2026)

Archivo custom de PostgreSQL 17 mediante instantánea compartida con inventario de tablas y migraciones; configuración privada en JSON con lista explícita y manifiesto SHA-256. Credenciales de conexión solo en el entorno de procesos, sin shell ni valores secretos en argumentos. Restauración exclusivamente a un nombre nuevo, roles aleatorios separados, ACL retiradas y permisos reconstruidos desde la lista del proyecto. Comprobación de conteos y RLS; se eliminan sesiones y recuperaciones copiadas, conservando contraseñas y enlaces de invitados. Limpieza limitada a los recursos recién creados, con comprobación de identidad de base.

Verificado: lint, tipos y 118 pruebas unitarias/SQL aprobadas. Las seis nuevas cubren selección de secretos, caracteres especiales, nombres y rutas protegidas, conexiones PostgreSQL y entorno de vista local sin credenciales administrativas ni entrega SMTP. No se modifican migraciones aplicadas ni la base de uso diario.

## 34. Comandos y guía de recuperación (30/10/2026)

Comandos db:backup, db:verify, db:restore y db:preview, con opciones validadas y salida sin credenciales. La vista usa el usuario restringido, otro hostname local, buzón de la copia y SMTP/CAPTCHA deshabilitados. La guía documenta copia privada fuera del equipo, traslado a otra PC, separación de conexiones y ausencia de sustitución automática de la base activa. Los archivos no están cifrados ni firmados; se restauran solo respaldos propios de confianza.

Verificado: respaldo real de la base diaria creado en .local/backups, con 13 tablas y configuración privada de enlaces. db:verify restauró ese archivo, comparó conteos y permisos y eliminó la base temporal y sus roles. La base activa y su configuración permanecen conservadas. Formato y diff correctos; opciones del launcher contrastadas con la documentación local de Next.js 16.

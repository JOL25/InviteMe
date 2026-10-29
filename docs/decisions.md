# Decisiones de implementación

## Alcance acordado

Se parte de la guía de desarrollo revisada el 22 de octubre de 2026. El MVP usa una plantilla clásica, una portada y confirmaciones abiertas por enlace. No existe un padrón de invitados, por lo que no se calcula un total de pendientes. Galería, itinerario, invitados nominativos, edición/cancelación de RSVP, pagos y mensajería quedan fuera de esta versión.

## Seguridad y datos

- Autenticación SSR mediante cookies. Cada operación privada verifica la identidad en servidor; las consultas privadas exigen el propietario autenticado.
- Invitaciones públicas mediante una proyección explícita desde servidor. Nunca se entrega `owner_id`, datos de invitados ni credenciales secretas.
- La escritura pública de RSVP pasa por una API y una función SQL transaccional, invocada solo desde servidor. Bloqueo del evento para serializar cambios de capacidad y reservas.
- Una clave UUID de idempotencia evita duplicados por reintento. No pretende identificar a una persona: con enlaces abiertos, una misma persona puede responder desde varios dispositivos.
- Solo las respuestas afirmativas consumen cupo. Cerrar RSVP conserva la invitación visible. Despublicar hace inaccesible la invitación pública.
- Capacidad reducida nunca puede quedar por debajo de asistentes ya confirmados.
- Portadas en PostgreSQL local como bytea, servidas por una ruta que verifica publicación o propiedad en cada petición.
- Fechas almacenadas como `timestamptz` y zona IANA separada. El formulario convierte desde la zona del evento.
- El tema se guarda en la misma fila del evento para que datos y personalización se actualicen atómicamente. Se separará en una tabla cuando existan temas reutilizables. La identidad local procede de `app_users` y `app_sessions`; los formularios no deciden el propietario.

## Dependencias y despliegue

Dependencias fijadas y lockfile versionado. Cada commit debe indicar sus comprobaciones en `docs/progress.md`. No se versionan secretos. Desde el 29/10/2026 el destino de desarrollo es PostgreSQL local exclusivo de InviteMe. Supabase se conserva pausado. Base nueva vacía por decisión del usuario. Para alojar fuera del equipo se necesita PostgreSQL accesible desde el servidor.

## Referencias técnicas

- https://nextjs.org/docs/app/getting-started/installation
- https://node-postgres.com/features/queries
- https://node-postgres.com/features/transactions

# Decisiones de implementación

## Alcance acordado

Se parte de la guía de desarrollo revisada el 22 de octubre de 2026. El MVP usa una plantilla clásica, una portada y confirmaciones abiertas por enlace. Las ampliaciones incorporan una galería opcional de hasta ocho fotos, una lista de invitados con enlaces individuales y pendientes fiables, un itinerario de hasta 20 actividades y edición/cancelación de RSVP con enlace privado. Pagos y mensajería siguen fuera del alcance de esta entrega.

## Seguridad y datos

- Autenticación SSR mediante cookies. Cada operación privada verifica la identidad en servidor; las consultas privadas exigen el propietario autenticado y las políticas RLS vuelven a limitar las filas en PostgreSQL. La aplicación usa un rol distinto al dueño de las tablas, sin BYPASSRLS.
- Invitaciones públicas mediante una proyección explícita desde servidor. Nunca se entrega `owner_id`, datos de invitados ni credenciales secretas.
- La escritura pública de RSVP pasa por una API y una función SQL transaccional, invocada solo desde servidor. Bloqueo del evento para serializar cambios de capacidad y reservas.
- Una clave UUID de idempotencia evita duplicados por reintento. No pretende identificar a una persona: con enlaces abiertos, una misma persona puede responder desde varios dispositivos.
- Solo las respuestas afirmativas consumen cupo. Cerrar RSVP conserva la invitación visible. Despublicar hace inaccesible la invitación pública.
- La edición usa un enlace de acceso privado y control de versión; no se identifica al invitado por nombre o correo. Los enlaces nominativos permiten gestionar su propia respuesta mientras estén vigentes; las respuestas abiertas nuevas reciben un token aleatorio de 256 bits, almacenado solo como hash. Las respuestas abiertas antiguas sin token no se pueden reclamar mediante una clave de reintento. Cancelar marca la respuesta como no asistente, conserva sus datos y libera cupos; no incrementa pendientes. Puede cancelarse con RSVP cerrado, pero para editar o reconfirmar debe estar abierto. El cálculo de capacidad excluye la reserva que se está reemplazando.
- Capacidad reducida nunca puede quedar por debajo de asistentes ya confirmados.
- Portadas y fotos de galería en PostgreSQL local como bytea, servidas por rutas que verifican publicación o propiedad en cada petición. La galería admite ocho fotos, con descripción accesible, pie opcional y orden editable. Las modificaciones de orden, altas y bajas se serializan bloqueando el evento; el esquema impone ocho posiciones únicas.
- Fechas almacenadas como `timestamptz` y zona IANA separada. El formulario convierte desde la zona del evento.
- Itinerario ordenado por fecha/hora y UUID como desempate estable. Cada actividad tiene su propio instante, permitiendo varios días; cambiar la zona del evento conserva esos instantes y modifica su presentación. La zona enviada por el navegador no decide la conversión: el servidor consulta la del evento bajo bloqueo. No se permite reordenar manualmente de forma contraria a los horarios.
- El tema se guarda en la misma fila del evento para que datos y personalización se actualicen atómicamente. Se separará en una tabla cuando existan temas reutilizables. La identidad local procede de `app_users` y `app_sessions`; los formularios no deciden el propietario.

## Dependencias y despliegue

Dependencias fijadas y lockfile versionado. Cada commit debe indicar sus comprobaciones en `docs/progress.md`. No se versionan secretos. Desde el 29/10/2026 el destino de desarrollo es PostgreSQL local exclusivo de InviteMe. Supabase se conserva pausado. Base nueva vacía por decisión del usuario. Para alojar fuera del equipo se necesita PostgreSQL accesible desde el servidor.

## Referencias técnicas

- https://nextjs.org/docs/app/getting-started/installation
- https://node-postgres.com/features/queries
- https://node-postgres.com/features/transactions

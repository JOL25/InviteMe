# Decisiones de implementación

## Alcance acordado

Se parte de la guía de desarrollo revisada el 22 de octubre de 2026. El MVP usa una plantilla clásica, una portada y confirmaciones abiertas por enlace. No existe un padrón de invitados, por lo que no se calcula un total de pendientes. Galería, itinerario, invitados nominativos, edición/cancelación de RSVP, pagos y mensajería quedan fuera de esta versión.

## Seguridad y datos

- Autenticación SSR mediante cookies. Cada operación privada verifica la identidad en servidor; RLS limita el acceso por propietario.
- Invitaciones públicas mediante una proyección explícita desde servidor. Nunca se entrega `owner_id`, datos de invitados ni credenciales secretas.
- La escritura pública de RSVP pasa por una API y una función SQL transaccional, invocada solo desde servidor. Bloqueo del evento para serializar cambios de capacidad y reservas.
- Una clave UUID de idempotencia evita duplicados por reintento. No pretende identificar a una persona: con enlaces abiertos, una misma persona puede responder desde varios dispositivos.
- Solo las respuestas afirmativas consumen cupo. Cerrar RSVP conserva la invitación visible. Despublicar hace inaccesible la invitación pública.
- Capacidad reducida nunca puede quedar por debajo de asistentes ya confirmados.
- Portadas en bucket privado. Las URL firmadas caducan; una URL emitida antes de despublicar puede seguir vigente durante su plazo corto.
- Fechas almacenadas como `timestamptz` y zona IANA separada. El formulario convierte desde la zona del evento.
- El tema se guarda en la misma fila del evento para que datos y personalización se actualicen atómicamente. Se separará en una tabla cuando existan temas reutilizables. No se crea `profiles`: la identidad procede de Auth; los metadatos no otorgan permisos.

## Dependencias y despliegue

Dependencias fijadas y lockfile versionado. Cada commit debe indicar sus comprobaciones en `docs/progress.md`. No se versionan secretos. El destino previsto es Vercel y un proyecto exclusivo de Supabase; la infraestructura de otros proyectos no se reutiliza.

## Referencias técnicas

- https://nextjs.org/docs/app/getting-started/installation
- https://supabase.com/docs/guides/auth/server-side/creating-a-client
- https://supabase.com/docs/guides/database/postgres/row-level-security

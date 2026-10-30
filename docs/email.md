# Correo de recuperación

InviteMe admite el buzón local existente y SMTP para los mensajes de recuperación y aviso de cambio de contraseña. Por elección del propietario, el equipo conserva `PASSWORD_RESET_DELIVERY=local`; no hay proveedor ni envío externo activado.

## Activar un proveedor más adelante

Configura un servidor SMTP y un remitente autorizado por ese proveedor. Guarda los datos solo en las variables privadas del servidor o en `.env.local`, fuera de Git:

```dotenv
PASSWORD_RESET_DELIVERY=smtp
SMTP_HOST=smtp.tu-proveedor.example
SMTP_PORT=587
SMTP_USER=tu_usuario_smtp
SMTP_PASSWORD=tu_clave_smtp
SMTP_FROM=cuentas@tu-dominio.example
NEXT_PUBLIC_SITE_URL=https://invitaciones.tu-dominio.example
```

Reinicia el proceso de la web después de configurar las variables. La dirección del remitente debe ser un correo, sin nombre de presentación; InviteMe añade el nombre de la aplicación. Las claves no se cargan en componentes del navegador ni se muestran en la página. No uses prefijos `NEXT_PUBLIC_` para datos SMTP.

En el puerto 465 se exige TLS desde el inicio; en los demás se exige STARTTLS, con validación de certificados y TLS 1.2 como mínimo. No hay una opción de producción para desactivar estas comprobaciones. Esta elección sigue las opciones del [transporte SMTP de Nodemailer](https://nodemailer.com/smtp). El mensaje contiene versiones de texto y HTML, un solo destinatario y ningún adjunto ni recurso remoto.

Para una web pública, configura HTTPS y un dominio que apunte al servidor de InviteMe. Al probar desde tu propia PC puedes conservar `http://localhost:3101`; el enlace recibido abrirá esa misma PC. Un enlace a localhost no sirve para que otra persona acceda desde otro equipo. No hace falta cambiar la base ni reactivar Supabase.

## Comportamiento y fallos

El envío SMTP se ejecuta mediante `after` después de responder a la solicitud, para que la latencia o el rechazo del servidor no expongan si existe una cuenta. La respuesta sigue siendo genérica y se conservan los límites por correo e IP. Solo se envía cuando la función de recuperación emite un token para una cuenta existente. Un fallo registra un aviso genérico en el servidor, sin token, contraseña SMTP ni destinatario.

Esta entrega no usa una cola persistente ni reintentos automáticos. Si el proceso se detiene antes de terminar o el proveedor rechaza el mensaje, el usuario puede solicitar otro enlace, respetando los límites vigentes. El aviso posterior al cambio no altera el resultado del cambio de contraseña si falla su entrega. Para activar un proveedor real hay que comprobar sus credenciales, el remitente y la llegada a su bandeja de destino; las pruebas locales no acreditan esa entrega externa.

Una configuración SMTP incompleta deshabilita la recuperación; no cambia automáticamente al buzón local. El buzón local se consulta como siempre con `npm run mail:local`.

## Pruebas sin envío externo

```powershell
npm run test:smtp
```

El runner crea una base PostgreSQL temporal y un servidor SMTP de captura que solo escucha en `127.0.0.1`, con puerto aleatorio y archivos en un directorio privado temporal de `.local`. Comprueba el enlace y el aviso recibidos, contenido MIME, token almacenado como hash, cierre de sesiones, respuesta genérica, servidor demorado, rechazo y recuperación de la entrega tras corregir el fallo. Se eliminan los datos y el servidor al terminar. No se usan credenciales del proveedor ni se reenvían los mensajes a Internet.

El modo interno `smtp-test` permite conexiones sin TLS únicamente si tanto la URL de la web como el servidor SMTP son de loopback. No debe configurarse para uso habitual. La suite unitaria también conecta un cliente de producción a un servidor local sin STARTTLS y exige que rechace la conexión antes de transmitir el mensaje. CI ejecuta las pruebas públicas, las de PostgreSQL local y las de captura SMTP por separado.

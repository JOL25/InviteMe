import { localRecoveryEnabled, localMessages } from './local-mail.mjs';
if (!localRecoveryEnabled())
  throw new Error(
    'El buzón local exige PASSWORD_RESET_DELIVERY=local y una URL de localhost.',
  );
const position = process.argv.indexOf('--email');
const email =
  position < 0 ? '' : (process.argv[position + 1] || '').trim().toLowerCase();
const messages = (await localMessages()).filter(
  (message) => !email || message.to === email,
);
if (!messages.length) console.log('No hay mensajes locales vigentes.');
for (const message of messages) {
  console.log(`\nPara: ${message.to}\nFecha: ${message.created_at}`);
  console.log(
    message.kind === 'reset'
      ? `Restablecer contraseña (30 minutos, un solo uso):\n${message.link}`
      : 'Tu contraseña fue cambiada. Las sesiones anteriores se cerraron.',
  );
}

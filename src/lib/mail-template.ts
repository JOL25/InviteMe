import { z } from 'zod';
export type RecoveryMail = {
  to: string;
  kind: 'reset' | 'changed';
  link?: string;
};
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        character
      ]!,
  );
export function recoveryMailContent(input: RecoveryMail, siteUrl: string) {
  if (!z.email().safeParse(input.to).success)
    throw new Error('Destinatario inválido.');
  let link = '';
  if (input.kind === 'reset') {
    const url = new URL(input.link ?? '');
    if (
      url.origin !== new URL(siteUrl).origin ||
      url.username ||
      url.password ||
      url.pathname !== '/reset-password' ||
      url.search ||
      !/^#token=[a-f0-9]{64}$/.test(url.hash)
    )
      throw new Error('Enlace de recuperación inválido.');
    link = url.toString();
  }
  const title =
    input.kind === 'reset'
      ? 'Recupera tu cuenta.'
      : 'Tu contraseña fue actualizada.';
  const description =
    input.kind === 'reset'
      ? 'Usa este enlace para elegir una nueva contraseña. Caduca en 30 minutos y funciona una sola vez.'
      : 'Las sesiones anteriores de tu cuenta se cerraron. Puedes iniciar sesión de nuevo con tu nueva contraseña.';
  const footer =
    input.kind === 'reset'
      ? 'Si no solicitaste este cambio, puedes ignorar este mensaje. Tu contraseña sigue siendo la misma.'
      : 'Si no realizaste este cambio, solicita un nuevo enlace de recuperación desde InviteMe.';
  return {
    subject:
      input.kind === 'reset'
        ? 'InviteMe: recupera tu cuenta'
        : 'InviteMe: contraseña actualizada',
    text: `InviteMe\n\n${title}\n\n${description}${link ? `\n\n${link}` : ''}\n\n${footer}`,
    html: `<!doctype html><html lang="es"><body style="margin:0;background:#fff9f1;color:#18233b;font:16px Arial,sans-serif"><main style="max-width:560px;margin:32px auto;padding:32px"><p style="font:28px Georgia,serif">InviteMe.</p><h1 style="font:32px Georgia,serif">${title}</h1><p style="line-height:1.7">${description}</p>${link ? `<p style="margin:28px 0"><a href="${escape(link)}" style="display:inline-block;background:#18233b;color:#fff;padding:16px 24px;text-decoration:none;border-radius:6px">Elegir nueva contraseña</a></p><p style="font-size:13px;overflow-wrap:anywhere">También puedes copiar este enlace:<br>${escape(link)}</p>` : ''}<p style="font-size:13px;line-height:1.7">${footer}</p></main></body></html>`,
  };
}

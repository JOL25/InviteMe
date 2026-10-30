import { isIP } from 'node:net';
import { z } from 'zod';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { localRecoveryEnabled } from '../../scripts/local-mail.mjs';
type Environment = Record<string, string | undefined>;
const loopback = (host: string) =>
  ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host);
export function smtpConfiguration(env: Environment = process.env) {
  const test = env.PASSWORD_RESET_DELIVERY === 'smtp-test';
  if (!test && env.PASSWORD_RESET_DELIVERY !== 'smtp')
    throw new Error('El transporte SMTP no está habilitado.');
  const host = env.SMTP_HOST?.trim() ?? '';
  const port = Number(env.SMTP_PORT || (test ? '' : '587'));
  const from = env.SMTP_FROM?.trim() ?? '';
  let site: URL;
  try {
    site = new URL(env.NEXT_PUBLIC_SITE_URL || '');
  } catch {
    throw new Error(
      'Configura la URL del sitio para los enlaces de recuperación.',
    );
  }
  if (
    site.username ||
    site.password ||
    !['http:', 'https:'].includes(site.protocol) ||
    (site.protocol !== 'https:' && !loopback(site.hostname))
  )
    throw new Error('El sitio debe usar HTTPS o una URL local.');
  if (
    (!isIP(host) && !/^[a-zA-Z0-9][a-zA-Z0-9.-]{0,252}$/.test(host)) ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    !z.email().safeParse(from).success
  )
    throw new Error('Revisa el servidor, puerto y remitente SMTP.');
  if (test && (!loopback(host) || !loopback(site.hostname)))
    throw new Error('El SMTP de pruebas solo admite conexiones locales.');
  if (!test && (!env.SMTP_USER || !env.SMTP_PASSWORD))
    throw new Error('Configura las credenciales SMTP en el servidor.');
  const options: SMTPTransport.Options = {
    host,
    port,
    secure: !test && port === 465,
    requireTLS: !test && port !== 465,
    ignoreTLS: test,
    ...(!test
      ? { auth: { user: env.SMTP_USER!, pass: env.SMTP_PASSWORD! } }
      : {}),
    tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    dnsTimeout: 10000,
    logger: false,
    debug: false,
    disableFileAccess: true,
    disableUrlAccess: true,
  };
  return { from, options, test };
}
export function recoveryDelivery(): 'local' | 'smtp' | 'smtp-test' | null {
  if (process.env.PASSWORD_RESET_DELIVERY === 'local')
    return localRecoveryEnabled() ? 'local' : null;
  try {
    const config = smtpConfiguration();
    return config.test ? 'smtp-test' : 'smtp';
  } catch {
    return null;
  }
}

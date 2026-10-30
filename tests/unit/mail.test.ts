import { afterEach, it, expect, vi } from 'vitest';
import nodemailer from 'nodemailer';
import { SMTPServer } from 'smtp-server';
import { smtpConfiguration, recoveryDelivery } from '@/lib/mail-config';
import { recoveryMailContent } from '@/lib/mail-template';
const base = {
  PASSWORD_RESET_DELIVERY: 'smtp',
  NEXT_PUBLIC_SITE_URL: 'https://inviteme.example',
  SMTP_HOST: 'smtp.example',
  SMTP_PORT: '587',
  SMTP_USER: 'test-user',
  SMTP_PASSWORD: 'test-password',
  SMTP_FROM: 'recovery@inviteme.example',
};
afterEach(() => {
  vi.unstubAllEnvs();
});
it('exige STARTTLS y validación de certificados para el puerto de envío estándar', () => {
  const { options } = smtpConfiguration(base);
  expect(options.requireTLS).toBe(true);
  expect(options.secure).toBe(false);
  expect(options.tls).toMatchObject({
    rejectUnauthorized: true,
    minVersion: 'TLSv1.2',
  });
  expect(options.disableFileAccess).toBe(true);
  expect(options.disableUrlAccess).toBe(true);
  expect(options.debug).toBe(false);
  expect(options.logger).toBe(false);
});
it('usa TLS implícito en el puerto 465', () => {
  expect(smtpConfiguration({ ...base, SMTP_PORT: '465' }).options.secure).toBe(
    true,
  );
});
it('rechaza configuraciones incompletas, remitentes inyectados y sitios remotos sin HTTPS', () => {
  for (const change of [
    { SMTP_HOST: '' },
    { SMTP_HOST: 'smtp://user:secret@example.com' },
    { SMTP_PORT: 'NaN' },
    { SMTP_PORT: '65536' },
    { SMTP_FROM: 'user@example.com\r\nBcc:other@example.com' },
    { SMTP_FROM: 'one@example.com,two@example.com' },
    { SMTP_USER: '' },
    { SMTP_PASSWORD: '' },
    { NEXT_PUBLIC_SITE_URL: 'http://inviteme.example' },
    { NEXT_PUBLIC_SITE_URL: 'https://user:secret@inviteme.example' },
  ])
    expect(() => smtpConfiguration({ ...base, ...change })).toThrow();
});
it('solo permite SMTP sin TLS cuando tanto el servidor como la web son de loopback y el modo es de pruebas', () => {
  const test = {
    ...base,
    PASSWORD_RESET_DELIVERY: 'smtp-test',
    NEXT_PUBLIC_SITE_URL: 'http://localhost:3102',
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: '2525',
    SMTP_USER: '',
    SMTP_PASSWORD: '',
  };
  expect(smtpConfiguration(test).options).toMatchObject({
    ignoreTLS: true,
    secure: false,
    requireTLS: false,
  });
  expect(smtpConfiguration(test).options.auth).toBeUndefined();
  expect(() =>
    smtpConfiguration({ ...test, SMTP_HOST: 'smtp.example' }),
  ).toThrow();
  expect(() =>
    smtpConfiguration({
      ...test,
      NEXT_PUBLIC_SITE_URL: 'https://inviteme.example',
    }),
  ).toThrow();
});
it('el modo local sigue siendo explícito y una configuración SMTP incompleta no cae al buzón local', () => {
  vi.stubEnv('PASSWORD_RESET_DELIVERY', 'local');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3101');
  expect(recoveryDelivery()).toBe('local');
  vi.stubEnv('PASSWORD_RESET_DELIVERY', 'smtp');
  vi.stubEnv('SMTP_HOST', '');
  expect(recoveryDelivery()).toBeNull();
});
it('genera texto y HTML del enlace canónico sin recursos externos', () => {
  const link = `https://inviteme.example/reset-password#token=${'a'.repeat(64)}`;
  const content = recoveryMailContent(
    { to: 'guest@example.com', kind: 'reset', link },
    base.NEXT_PUBLIC_SITE_URL,
  );
  expect(content.text).toContain(link);
  expect(content.html).toContain(`href="${link}"`);
  expect(content.html).toContain('Elegir nueva contraseña');
  expect(content.html).not.toMatch(/<script|<img|<iframe/i);
  expect(content.text).toContain('30 minutos');
});
it('rechaza destinatarios múltiples y enlaces manipulados', () => {
  const link = `https://inviteme.example/reset-password#token=${'a'.repeat(64)}`;
  for (const changed of [
    link.replace('inviteme.example', 'attacker.example'),
    link.replace('/reset-password', '/login'),
    link.replace('#token=', '?token='),
    'javascript:alert(1)',
  ])
    expect(() =>
      recoveryMailContent(
        { to: 'guest@example.com', kind: 'reset', link: changed },
        base.NEXT_PUBLIC_SITE_URL,
      ),
    ).toThrow();
  expect(() =>
    recoveryMailContent(
      { to: 'one@example.com,two@example.com', kind: 'reset', link },
      base.NEXT_PUBLIC_SITE_URL,
    ),
  ).toThrow();
});
it('el aviso de cambio no reutiliza ni incluye un token de recuperación', () => {
  const content = recoveryMailContent(
    {
      to: 'guest@example.com',
      kind: 'changed',
      link: `https://inviteme.example/reset-password#token=${'a'.repeat(64)}`,
    },
    base.NEXT_PUBLIC_SITE_URL,
  );
  expect(content.text).toContain('sesiones anteriores');
  expect(content.text + content.html).not.toContain('#token=');
});
it('un SMTP real que no ofrece STARTTLS es rechazado antes de transmitir el mensaje', async () => {
  let messages = 0;
  const server = new SMTPServer({
    secure: false,
    authOptional: true,
    disabledCommands: ['AUTH', 'STARTTLS'],
    disableReverseLookup: true,
    logger: false,
    closeTimeout: 1000,
    onData(stream, _session, callback) {
      messages++;
      stream.resume();
      stream.on('end', callback);
    },
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.server.address();
  if (!address || typeof address === 'string')
    throw new Error('Test SMTP did not start');
  const transport = nodemailer.createTransport(
    smtpConfiguration({
      ...base,
      SMTP_HOST: '127.0.0.1',
      SMTP_PORT: String(address.port),
    }).options,
  );
  try {
    await expect(
      transport.sendMail({
        from: base.SMTP_FROM,
        to: 'guest@example.com',
        text: 'TLS refusal test',
      }),
    ).rejects.toMatchObject({ code: 'ETLS' });
    expect(messages).toBe(0);
  } finally {
    transport.close();
    await new Promise<void>((resolve) => server.close(resolve));
  }
});

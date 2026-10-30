import 'server-only';
import nodemailer from 'nodemailer';
import { after } from 'next/server';
import { siteUrl } from '@/lib/env';
import { recoveryDelivery, smtpConfiguration } from '@/lib/mail-config';
import { recoveryMailContent, type RecoveryMail } from '@/lib/mail-template';
import { localMessages, writeLocalMessage } from '../../scripts/local-mail.mjs';
export async function prepareRecoveryMail() {
  const delivery = recoveryDelivery();
  if (!delivery)
    throw new Error('La entrega de recuperación no está configurada.');
  if (delivery === 'local') await localMessages();
  return delivery;
}
export async function deliverRecoveryMail(input: RecoveryMail) {
  const content = recoveryMailContent(input, siteUrl());
  if (recoveryDelivery() === 'local') {
    await writeLocalMessage(input);
    return;
  }
  const { from, options } = smtpConfiguration();
  const transport = nodemailer.createTransport(options);
  try {
    const result = await transport.sendMail({
      from: { name: 'InviteMe', address: from },
      to: { address: input.to, name: '' },
      ...content,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    if (result.rejected?.length || result.accepted?.length !== 1)
      throw new Error('El servidor no aceptó el destinatario.');
  } finally {
    transport.close();
  }
}
export async function dispatchRecoveryMail(input: RecoveryMail) {
  if (recoveryDelivery() === 'local') {
    await deliverRecoveryMail(input);
    return;
  }
  // SMTP latency and failures must not reveal whether the account exists.
  after(async () => {
    try {
      await deliverRecoveryMail(input);
    } catch {
      console.error(
        '[InviteMe] Falló la entrega de un correo de recuperación. Revisa la configuración SMTP.',
      );
    }
  });
}

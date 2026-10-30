import { z } from 'zod';
export const invitationTokenSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/, 'El enlace individual no es válido.');
export const guestDetailsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Escribe al menos 2 caracteres para el nombre.')
    .max(120),
  email: z
    .union([z.literal(''), z.email('Escribe un correo válido.').max(254)])
    .default(''),
  max_party_size: z.coerce.number().int().min(1).max(10),
});

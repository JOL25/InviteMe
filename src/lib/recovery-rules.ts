import { z } from 'zod';
export const recoveryRequestSchema = z.object({
  email: z.email('Escribe un correo válido.').max(254),
});
export const recoveryResetSchema = z
  .object({
    token: z.string().regex(/^[a-f0-9]{64}$/, 'El enlace no es válido.'),
    password: z.string().min(10, 'Usa al menos 10 caracteres.').max(128),
    confirmation: z.string().max(128),
  })
  .refine((value) => value.password === value.confirmation, {
    path: ['confirmation'],
    message: 'Las contraseñas no coinciden.',
  });
export const recoveryMessage =
  'Si existe una cuenta con ese correo y no se superó el límite de solicitudes, encontrarás las instrucciones en el buzón local. El enlace caduca en 30 minutos.';
export const recoveryEmailMessage =
  'Si existe una cuenta con ese correo y no se superó el límite de solicitudes, recibirás las instrucciones por correo. El enlace caduca en 30 minutos.';

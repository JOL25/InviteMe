import { z } from 'zod';
import { contrastRatio } from '@/lib/colors';
import { invitationTokenSchema } from '@/lib/invite-rules';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

export const categories = [
  'wedding',
  'birthday',
  'graduation',
  'other',
] as const;
export const categoryLabels: Record<(typeof categories)[number], string> = {
  wedding: 'Boda',
  birthday: 'Cumpleaños',
  graduation: 'Graduación',
  other: 'Otra celebración',
};
const optionalText = (max: number) => z.string().trim().max(max).default('');
export const timezoneSchema = z.string().refine((zone) => {
  try {
    new Intl.DateTimeFormat('es', { timeZone: zone }).format();
    return true;
  } catch {
    return false;
  }
}, 'Selecciona una zona horaria válida.');
const mapSchema = optionalText(2000).refine((value) => {
  if (!value) return true;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}, 'Usa un enlace de mapa HTTPS.');
export const eventSchema = z
  .object({
    title: z.string().trim().min(3, 'Escribe al menos 3 caracteres.').max(120),
    category: z.enum(categories),
    timezone: timezoneSchema,
    localDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Indica fecha y hora.'),
    venue_name: z.string().trim().min(2, 'Indica el lugar.').max(160),
    venue_address: optionalText(300),
    map_url: mapSchema,
    capacity: z.preprocess(
      (v) => (v === '' || v === undefined || v === null ? null : Number(v)),
      z.number().int().min(1).max(100000).nullable(),
    ),
    message: z
      .string()
      .trim()
      .min(3, 'Escribe un mensaje para tus invitados.')
      .max(3000),
    primary_color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .refine(
        (color) => contrastRatio(color, '#eee7db') >= 4.5,
        'Elige un color principal más oscuro para que el texto sea legible.',
      ),
    accent_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    rsvp_open: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (!timezoneSchema.safeParse(data.timezone).success) return;
    const utc = fromZonedTime(data.localDate, data.timezone);
    if (
      !Number.isFinite(utc.getTime()) ||
      formatInTimeZone(utc, data.timezone, "yyyy-MM-dd'T'HH:mm") !==
        data.localDate
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['localDate'],
        message: 'La fecha no existe en la zona horaria seleccionada.',
      });
    }
  });
export type EventInput = z.infer<typeof eventSchema>;
export const rsvpSchema = z.object({
  slug: z
    .string()
    .min(3)
    .max(150)
    .regex(/^[a-z0-9-]+$/),
  guestName: z.string().trim().min(2, 'Escribe tu nombre.').max(120),
  guestEmail: z
    .union([z.literal(''), z.email().max(254)])
    .optional()
    .default(''),
  attendance: z.boolean(),
  partySize: z.number().int().min(1).max(10),
  note: optionalText(500),
  idempotencyKey: z.uuid(),
  inviteToken: invitationTokenSchema.optional(),
  managementToken: invitationTokenSchema.optional(),
  website: z.literal('').optional().default(''),
  turnstileToken: z.string().max(2048).optional(),
});
export const authSchema = z.object({
  email: z.email('Escribe un correo válido.').max(254),
  password: z.string().min(10, 'Usa al menos 10 caracteres.').max(128),
});
export function eventValues(input: EventInput) {
  const { localDate, ...data } = input;
  return {
    ...data,
    starts_at: fromZonedTime(localDate, input.timezone).toISOString(),
  };
}

import { z } from 'zod';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
export const maxActivities = 20;
export const activitySchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, 'Escribe un título de al menos 2 caracteres.')
    .max(120),
  description: z.string().trim().max(500),
  venue_name: z.string().trim().max(160),
  localDate: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/,
      'Indica la fecha y hora de la actividad.',
    ),
});
export function activityInstant(
  localDate: string,
  timezone: string,
): string | null {
  try {
    const date = fromZonedTime(localDate, timezone);
    if (
      !Number.isFinite(date.getTime()) ||
      formatInTimeZone(date, timezone, "yyyy-MM-dd'T'HH:mm") !== localDate
    )
      return null;
    return date.toISOString();
  } catch {
    return null;
  }
}

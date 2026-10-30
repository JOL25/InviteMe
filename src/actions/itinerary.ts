'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { activitySchema } from '@/lib/itinerary-rules';
import { saveActivity, deleteActivity } from '@/lib/itinerary';
export type ItineraryState = { error?: string; success?: string };
function refresh(id: string) {
  revalidatePath(`/dashboard/events/${id}/edit`);
  revalidatePath(`/dashboard/events/${id}/preview`);
  revalidatePath('/i/[slug]', 'page');
}
export async function updateItinerary(
  _state: ItineraryState,
  form: FormData,
): Promise<ItineraryState> {
  const { user } = await requireUser();
  const eventId = String(form.get('eventId') ?? ''),
    id = String(form.get('activityId') ?? '');
  if (
    !z.uuid().safeParse(eventId).success ||
    (id && !z.uuid().safeParse(id).success)
  )
    return { error: 'Actividad no válida.' };
  const details = activitySchema.safeParse(
    Object.fromEntries(
      ['title', 'description', 'venue_name', 'localDate'].map((key) => [
        key,
        String(form.get(key) ?? ''),
      ]),
    ),
  );
  if (!details.success) return { error: details.error.issues[0].message };
  try {
    const result = await saveActivity(eventId, user.id, id, details.data);
    if (result === 'missing')
      return { error: 'Actividad o evento no disponible.' };
    if (result === 'full')
      return { error: 'Puedes guardar hasta 20 actividades por evento.' };
    if (result === 'date')
      return { error: 'La fecha no existe en la zona horaria del evento.' };
  } catch {
    return { error: 'No pudimos guardar la actividad. Inténtalo de nuevo.' };
  }
  refresh(eventId);
  return {
    success: id ? 'Actividad actualizada.' : 'Actividad añadida al itinerario.',
  };
}
export async function removeActivity(
  _state: ItineraryState,
  form: FormData,
): Promise<ItineraryState> {
  const { user } = await requireUser();
  const eventId = String(form.get('eventId') ?? ''),
    id = String(form.get('activityId') ?? '');
  if (!z.uuid().safeParse(eventId).success || !z.uuid().safeParse(id).success)
    return { error: 'Actividad no válida.' };
  try {
    if (!(await deleteActivity(eventId, user.id, id)))
      return { error: 'Actividad no disponible.' };
  } catch {
    return { error: 'No pudimos eliminar la actividad.' };
  }
  refresh(eventId);
  return { success: 'Actividad eliminada.' };
}

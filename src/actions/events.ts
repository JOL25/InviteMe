'use server';
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { writeEvent, setPublication, removeEvent } from '@/lib/event-store';
import { requireUser } from '@/lib/auth';
import { eventSchema, eventValues } from '@/lib/validators';
export type EventState = {
  error?: string;
  values?: Record<string, string>;
  success?: string;
};
export async function saveEvent(
  _state: EventState,
  form: FormData,
): Promise<EventState> {
  const { user } = await requireUser();
  const id = String(form.get('id') || '');
  const values = Object.fromEntries(
    Array.from(form.entries()).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
  const input = eventSchema.safeParse({
    ...values,
    rsvp_open: form.get('rsvp_open') === 'on',
  });
  if (!input.success) return { error: input.error.issues[0].message, values };
  if (id && !z.uuid().safeParse(id).success)
    return { error: 'Evento no válido.', values };
  const data = eventValues(input.data);
  const slugBase =
    data.title
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 100) || 'celebracion';
  let result: { id: string } | undefined;
  try {
    result = await writeEvent(
      user.id,
      id,
      data,
      `${slugBase}-${randomUUID().slice(0, 8)}`,
    );
  } catch (error) {
    return {
      error:
        (error as { code?: string }).code === '23514'
          ? 'Revisa los datos. El cupo no puede ser menor que los asistentes confirmados.'
          : 'No pudimos guardar el evento. Inténtalo de nuevo.',
      values,
    };
  }
  if (!result) return { error: 'Evento no disponible.', values };
  revalidatePath('/dashboard');
  revalidatePath(`/dashboard/events/${result.id}/edit`);
  if (!id) redirect(`/dashboard/events/${result.id}/edit?created=1`);
  return { success: 'Cambios guardados.', values };
}
export async function changePublication(
  _state: EventState,
  form: FormData,
): Promise<EventState> {
  const { user } = await requireUser();
  const id = String(form.get('id') || '');
  if (!z.uuid().safeParse(id).success) return { error: 'Evento no válido.' };
  const publish = form.get('intent') === 'publish';
  try {
    if (!(await setPublication(id, user.id, publish)))
      return { error: 'Evento no disponible.' };
  } catch {
    return { error: 'No pudimos cambiar la publicación.' };
  }
  revalidatePath('/dashboard');
  revalidatePath(`/dashboard/events/${id}/edit`);
  return {
    success: publish
      ? 'Tu invitación ya está publicada.'
      : 'Tu invitación volvió a borrador.',
  };
}
export async function deleteEvent(
  _state: EventState,
  form: FormData,
): Promise<EventState> {
  const { user } = await requireUser();
  const id = String(form.get('id') || '');
  if (!z.uuid().safeParse(id).success) return { error: 'Evento no válido.' };
  try {
    if (!(await removeEvent(id, user.id)))
      return { error: 'Evento no disponible.' };
  } catch {
    return { error: 'No pudimos eliminar el evento.' };
  }
  revalidatePath('/dashboard');
  redirect('/dashboard');
}

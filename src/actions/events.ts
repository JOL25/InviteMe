'use server';
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
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
  const { supabase, user } = await requireUser();
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
  const result = id
    ? await supabase
        .from('events')
        .update(data)
        .eq('id', id)
        .eq('owner_id', user.id)
        .select('id')
        .maybeSingle()
    : await supabase
        .from('events')
        .insert({
          ...data,
          owner_id: user.id,
          slug: `${slugBase}-${randomUUID().slice(0, 8)}`,
        })
        .select('id')
        .single();
  if (result.error || !result.data)
    return {
      error:
        result.error?.code === '23514'
          ? 'Revisa los datos. El cupo no puede ser menor que los asistentes confirmados.'
          : 'No pudimos guardar el evento. Inténtalo de nuevo.',
      values,
    };
  revalidatePath('/dashboard');
  revalidatePath(`/dashboard/events/${result.data.id}/edit`);
  if (!id) redirect(`/dashboard/events/${result.data.id}/edit?created=1`);
  return { success: 'Cambios guardados.', values };
}
export async function changePublication(
  _state: EventState,
  form: FormData,
): Promise<EventState> {
  const { supabase, user } = await requireUser();
  const id = String(form.get('id') || '');
  if (!z.uuid().safeParse(id).success) return { error: 'Evento no válido.' };
  const publish = form.get('intent') === 'publish';
  const { data, error } = await supabase
    .from('events')
    .update({ published_at: publish ? new Date().toISOString() : null })
    .eq('id', id)
    .eq('owner_id', user.id)
    .select('id')
    .maybeSingle();
  if (error || !data) return { error: 'No pudimos cambiar la publicación.' };
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
  const { supabase, user } = await requireUser();
  const id = String(form.get('id') || '');
  if (!z.uuid().safeParse(id).success) return { error: 'Evento no válido.' };
  // Storage must be removed while the event still exists (ownership policy).
  const { data: event } = await supabase
    .from('events')
    .select('id')
    .eq('id', id)
    .eq('owner_id', user.id)
    .maybeSingle();
  if (!event) return { error: 'Evento no disponible.' };
  const prefix = `${user.id}/${id}`;
  const { data: files, error: listError } = await supabase.storage
    .from('covers')
    .list(prefix);
  if (listError)
    return { error: 'No pudimos comprobar la portada. Inténtalo de nuevo.' };
  if (files?.length) {
    const { error } = await supabase.storage
      .from('covers')
      .remove(files.map((file) => `${prefix}/${file.name}`));
    if (error) return { error: 'No pudimos eliminar los archivos del evento.' };
  }
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', id)
    .eq('owner_id', user.id);
  if (error) return { error: 'No pudimos eliminar el evento.' };
  revalidatePath('/dashboard');
  redirect('/dashboard');
}

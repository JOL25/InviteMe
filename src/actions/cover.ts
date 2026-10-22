'use server';
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { ownedEvent } from '@/lib/events';
import { imageExtension } from '@/lib/images';
import type { EventState } from '@/actions/events';
export async function uploadCover(
  _state: EventState,
  form: FormData,
): Promise<EventState> {
  const id = String(form.get('id') || '');
  const { event, supabase, user } = await ownedEvent(id);
  const file = form.get('cover');
  if (!(file instanceof File) || file.size === 0 || file.size > 3 * 1024 * 1024)
    return { error: 'Selecciona una imagen JPG, PNG o WebP de hasta 3 MB.' };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = imageExtension(bytes);
  if (!ext)
    return { error: 'El archivo no es una imagen JPG, PNG o WebP válida.' };
  const path = `${user.id}/${id}/${randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from('covers')
    .upload(path, bytes, {
      contentType: ext === 'jpg' ? 'image/jpeg' : `image/${ext}`,
      upsert: false,
    });
  if (uploadError)
    return { error: 'No pudimos subir la portada. Inténtalo de nuevo.' };
  const { data, error } = await supabase
    .from('events')
    .update({ cover_path: path })
    .eq('id', id)
    .eq('owner_id', user.id)
    .select('id')
    .maybeSingle();
  if (error || !data) {
    await supabase.storage.from('covers').remove([path]);
    return { error: 'No pudimos guardar la portada.' };
  }
  if (event.cover_path)
    await supabase.storage.from('covers').remove([event.cover_path]);
  revalidatePath(`/dashboard/events/${id}/edit`);
  return { success: 'Portada actualizada.' };
}

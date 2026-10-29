'use server';
import { revalidatePath } from 'next/cache';
import { storeCover } from '@/lib/event-store';
import { ownedEvent } from '@/lib/events';
import { imageExtension } from '@/lib/images';
import type { EventState } from '@/actions/events';
export async function uploadCover(
  _state: EventState,
  form: FormData,
): Promise<EventState> {
  const id = String(form.get('id') || '');
  const { user } = await ownedEvent(id);
  const file = form.get('cover');
  if (!(file instanceof File) || file.size === 0 || file.size > 3 * 1024 * 1024)
    return { error: 'Selecciona una imagen JPG, PNG o WebP de hasta 3 MB.' };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = imageExtension(bytes);
  if (!ext)
    return { error: 'El archivo no es una imagen JPG, PNG o WebP válida.' };
  try {
    if (!(await storeCover(id, user.id, Buffer.from(bytes), ext)))
      return { error: 'Evento no disponible.' };
  } catch {
    return { error: 'No pudimos guardar la portada.' };
  }
  revalidatePath(`/dashboard/events/${id}/edit`);
  return { success: 'Portada actualizada.' };
}

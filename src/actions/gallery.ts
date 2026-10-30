'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import {
  addGalleryPhoto,
  editGalleryPhoto,
  changeGalleryPhoto,
} from '@/lib/gallery';
import { photoDetailsSchema, maxPhotoBytes } from '@/lib/gallery-rules';
import { imageExtension } from '@/lib/images';
export type GalleryState = { error?: string; success?: string };
async function context(form: FormData, photoRequired = false) {
  const { user } = await requireUser();
  const eventId = String(form.get('eventId') ?? '');
  const photoId = String(form.get('photoId') ?? '');
  if (
    !z.uuid().safeParse(eventId).success ||
    (photoRequired && !z.uuid().safeParse(photoId).success)
  )
    return null;
  return { user, eventId, photoId };
}
function details(form: FormData) {
  return photoDetailsSchema.safeParse({
    alt_text: String(form.get('alt_text') ?? ''),
    caption: String(form.get('caption') ?? ''),
  });
}
function refresh(id: string) {
  revalidatePath(`/dashboard/events/${id}/edit`);
  revalidatePath(`/dashboard/events/${id}/preview`);
  revalidatePath('/i/[slug]', 'page');
}
export async function uploadGalleryPhoto(
  _state: GalleryState,
  form: FormData,
): Promise<GalleryState> {
  const ctx = await context(form);
  if (!ctx) return { error: 'Evento no válido.' };
  const input = details(form);
  if (!input.success) return { error: input.error.issues[0].message };
  const file = form.get('photo');
  if (!(file instanceof File) || file.size === 0 || file.size > maxPhotoBytes)
    return { error: 'Selecciona una foto JPG, PNG o WebP de hasta 3 MB.' };
  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = imageExtension(bytes);
  if (!ext)
    return { error: 'El archivo no es una imagen JPG, PNG o WebP válida.' };
  try {
    const result = await addGalleryPhoto(
      ctx.eventId,
      ctx.user.id,
      input.data,
      bytes,
      ext === 'jpg' ? 'image/jpeg' : `image/${ext}`,
    );
    if (result === 'full')
      return { error: 'Puedes guardar hasta 8 fotos por evento.' };
    if (result === 'missing') return { error: 'Evento no disponible.' };
  } catch {
    return { error: 'No pudimos guardar la foto. Inténtalo de nuevo.' };
  }
  refresh(ctx.eventId);
  return { success: 'Foto añadida a la galería.' };
}
export async function updateGalleryPhoto(
  _state: GalleryState,
  form: FormData,
): Promise<GalleryState> {
  const ctx = await context(form, true);
  if (!ctx) return { error: 'Foto no válida.' };
  const input = details(form);
  if (!input.success) return { error: input.error.issues[0].message };
  try {
    if (
      !(await editGalleryPhoto(
        ctx.eventId,
        ctx.user.id,
        ctx.photoId,
        input.data,
      ))
    )
      return { error: 'Foto no disponible.' };
  } catch {
    return { error: 'No pudimos guardar los detalles de la foto.' };
  }
  refresh(ctx.eventId);
  return { success: 'Detalles de la foto guardados.' };
}
export async function organizeGalleryPhoto(
  _state: GalleryState,
  form: FormData,
): Promise<GalleryState> {
  const ctx = await context(form, true);
  const intent = z
    .enum(['earlier', 'later', 'delete'])
    .safeParse(form.get('intent'));
  if (!ctx || !intent.success) return { error: 'Acción no válida.' };
  try {
    if (
      !(await changeGalleryPhoto(
        ctx.eventId,
        ctx.user.id,
        ctx.photoId,
        intent.data,
      ))
    )
      return { error: 'Foto no disponible.' };
  } catch {
    return { error: 'No pudimos actualizar la galería.' };
  }
  refresh(ctx.eventId);
  return {
    success:
      intent.data === 'delete' ? 'Foto eliminada.' : 'Orden actualizado.',
  };
}

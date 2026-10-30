import { z } from 'zod';
export const maxGalleryPhotos = 8;
export const maxPhotoBytes = 3 * 1024 * 1024;
export const photoDetailsSchema = z.object({
  alt_text: z
    .string()
    .trim()
    .min(3, 'Describe la foto con al menos 3 caracteres.')
    .max(180, 'La descripción admite hasta 180 caracteres.'),
  caption: z
    .string()
    .trim()
    .max(180, 'El pie de foto admite hasta 180 caracteres.')
    .default(''),
});

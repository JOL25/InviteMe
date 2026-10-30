'use client';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { ArrowUp, ArrowDown, Trash2, Images } from 'lucide-react';
import {
  uploadGalleryPhoto,
  updateGalleryPhoto,
  organizeGalleryPhoto,
  type GalleryState,
} from '@/actions/gallery';
import { SubmitButton } from '@/components/submit-button';
import { maxGalleryPhotos } from '@/lib/gallery-rules';
import type { GalleryItem } from '@/types/database';

function Feedback({ state }: { state: GalleryState }) {
  return (
    <>
      {state.error && (
        <p role="alert" className="error">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="field-help">
          {state.success}
        </p>
      )}
    </>
  );
}
function OrderButtons({ first, last }: { first: boolean; last: boolean }) {
  const { pending } = useFormStatus();
  return (
    <div className="gallery-order-buttons">
      <button
        className="button button-outline"
        type="submit"
        name="intent"
        value="earlier"
        disabled={pending || first}
        aria-label="Mover foto antes"
      >
        <ArrowUp size={16} aria-hidden="true" />
      </button>
      <button
        className="button button-outline"
        type="submit"
        name="intent"
        value="later"
        disabled={pending || last}
        aria-label="Mover foto después"
      >
        <ArrowDown size={16} aria-hidden="true" />
      </button>
      <button
        className="text-button danger"
        type="submit"
        name="intent"
        value="delete"
        disabled={pending}
      >
        <Trash2 size={15} aria-hidden="true" /> Eliminar foto
      </button>
    </div>
  );
}
function PhotoCard({
  photo,
  index,
  count,
}: {
  photo: GalleryItem;
  index: number;
  count: number;
}) {
  const [state, action] = useActionState(
    updateGalleryPhoto,
    {} as GalleryState,
  );
  const [orderState, orderAction] = useActionState(
    organizeGalleryPhoto,
    {} as GalleryState,
  );
  return (
    <article
      className="gallery-edit-card"
      aria-label={`Foto ${index + 1} de la galería`}
    >
      <picture>
        <img
          src={`/api/photos/${photo.id}`}
          alt={photo.alt_text}
          loading="lazy"
        />
      </picture>
      <div className="gallery-edit-body stack">
        <span className="eyebrow">
          FOTO {String(index + 1).padStart(2, '0')}
        </span>
        <form action={action} className="stack-sm">
          <input type="hidden" name="eventId" value={photo.event_id} />
          <input type="hidden" name="photoId" value={photo.id} />
          <label>
            Descripción de la foto
            <input
              name="alt_text"
              required
              minLength={3}
              maxLength={180}
              defaultValue={photo.alt_text}
            />
          </label>
          <label>
            Pie de foto <span className="optional">(opcional)</span>
            <input
              name="caption"
              maxLength={180}
              defaultValue={photo.caption}
            />
          </label>
          <SubmitButton className="button button-outline">
            Guardar detalles de la foto
          </SubmitButton>
          <Feedback state={state} />
        </form>
        <form
          action={orderAction}
          className="stack-sm"
          onSubmit={(event) => {
            const submitter = (event.nativeEvent as SubmitEvent)
              .submitter as HTMLButtonElement | null;
            if (
              submitter?.value === 'delete' &&
              !window.confirm(
                '¿Eliminar esta foto de la galería? Esta acción no se puede deshacer.',
              )
            )
              event.preventDefault();
          }}
        >
          <input type="hidden" name="eventId" value={photo.event_id} />
          <input type="hidden" name="photoId" value={photo.id} />
          <OrderButtons first={index === 0} last={index === count - 1} />
          <Feedback state={orderState} />
        </form>
      </div>
    </article>
  );
}
export function GalleryManager({
  eventId,
  photos,
}: {
  eventId: string;
  photos: GalleryItem[];
}) {
  const [state, action] = useActionState(
    uploadGalleryPhoto,
    {} as GalleryState,
  );
  const full = photos.length >= maxGalleryPhotos;
  return (
    <section
      className="panel stack gallery-manager"
      aria-labelledby="gallery-manager-title"
    >
      <div className="gallery-manager-heading">
        <div>
          <span className="eyebrow">04 / MOMENTOS PARA COMPARTIR</span>
          <h2 id="gallery-manager-title">Tu galería.</h2>
          <p className="field-help">
            Hasta ocho fotos, en el orden que tú elijas. Se mostrarán a tus
            invitados al publicar la invitación.
          </p>
        </div>
        <span className="badge">
          {photos.length} / {maxGalleryPhotos} fotos
        </span>
      </div>
      {photos.length > 0 ? (
        <div className="gallery-edit-grid">
          {photos.map((photo, index) => (
            <PhotoCard
              key={photo.id}
              photo={photo}
              index={index}
              count={photos.length}
            />
          ))}
        </div>
      ) : (
        <div className="gallery-empty">
          <Images size={28} strokeWidth={1} aria-hidden="true" />
          <p>Añade esos recuerdos que cuentan tu historia.</p>
        </div>
      )}
      <form action={action} className="stack gallery-upload">
        <input type="hidden" name="eventId" value={eventId} />
        <h3>Añadir una foto</h3>
        <p className="field-help" id="gallery-upload-help">
          JPG, PNG o WebP de hasta 3 MB. Sube una foto por vez. La descripción
          ayuda a quienes usan lectores de pantalla.
        </p>
        <label>
          Foto para la galería
          <input
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            disabled={full}
            aria-describedby="gallery-upload-help"
          />
        </label>
        <label>
          Descripción de la nueva foto
          <input
            name="alt_text"
            required
            minLength={3}
            maxLength={180}
            placeholder="Por ejemplo: Juntos en nuestro primer viaje"
            disabled={full}
          />
        </label>
        <label>
          Pie de la nueva foto <span className="optional">(opcional)</span>
          <input
            name="caption"
            maxLength={180}
            placeholder="Un recuerdo que queremos compartir"
            disabled={full}
          />
        </label>
        <SubmitButton pending="Subiendo foto…" disabled={full}>
          Añadir foto a la galería
        </SubmitButton>
        {full && (
          <p className="notice">
            Tu galería está completa. Elimina una foto para añadir otra.
          </p>
        )}
        <Feedback state={state} />
      </form>
    </section>
  );
}

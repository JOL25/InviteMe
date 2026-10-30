'use client';
import { useId, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Expand, X } from 'lucide-react';
import type { GalleryPhoto } from '@/types/database';

export function PhotoGallery({ photos }: { photos: GalleryPhoto[] }) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const [index, setIndex] = useState(0);
  if (!photos.length) return null;
  const current = Math.min(index, photos.length - 1);
  const photo = photos[current];
  function move(step: number) {
    setIndex((value) => Math.max(0, Math.min(photos.length - 1, value + step)));
  }
  return (
    <section
      className="invitation-gallery"
      aria-labelledby={titleId}
      data-reveal
    >
      <span className="eyebrow">NUESTRA HISTORIA, EN IMÁGENES</span>
      <h2 id={titleId}>Recuerdos que nos unen.</h2>
      <p className="muted gallery-intro">
        Pequeños instantes que hacen especial este gran momento.
      </p>
      <div className="photo-gallery-grid">
        {photos.map((item, i) => (
          <figure key={item.id} data-photo-id={item.id}>
            <button
              type="button"
              className="gallery-open"
              aria-label={`Ampliar foto ${i + 1}: ${item.alt_text}`}
              onClick={(event) => {
                trigger.current = event.currentTarget;
                setIndex(i);
                dialog.current?.showModal();
              }}
            >
              <picture>
                <img
                  src={item.url}
                  alt={item.alt_text}
                  loading="lazy"
                  decoding="async"
                />
              </picture>
              <span className="gallery-expand" aria-hidden="true">
                <Expand size={17} /> Ver foto
              </span>
            </button>
            {item.caption && <figcaption>{item.caption}</figcaption>}
          </figure>
        ))}
      </div>
      <dialog
        className="photo-dialog"
        ref={dialog}
        aria-labelledby={`${titleId}-viewer`}
        onClose={() => {
          if (trigger.current?.isConnected) trigger.current.focus();
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            move(event.key === 'ArrowLeft' ? -1 : 1);
          }
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        <div className="photo-dialog-content">
          <div className="photo-dialog-heading">
            <h2 id={`${titleId}-viewer`}>Fotos de la celebración</h2>
            <button
              type="button"
              className="photo-dialog-close"
              aria-label="Cerrar foto ampliada"
              onClick={() => dialog.current?.close()}
            >
              <X size={22} aria-hidden="true" />
            </button>
          </div>
          <picture>
            <img src={photo.url} alt={photo.alt_text} decoding="async" />
          </picture>
          <div className="photo-dialog-caption" aria-live="polite">
            <p>{photo.caption || photo.alt_text}</p>
            <span>
              Foto {current + 1} de {photos.length}
            </span>
          </div>
          <div className="photo-dialog-navigation">
            <button
              type="button"
              className="button button-outline"
              onClick={() => move(-1)}
              disabled={current === 0}
              aria-label="Foto anterior"
            >
              <ArrowLeft size={18} aria-hidden="true" /> Anterior
            </button>
            <span className="field-help">
              Puedes usar las flechas del teclado.
            </span>
            <button
              type="button"
              className="button button-outline"
              onClick={() => move(1)}
              disabled={current === photos.length - 1}
              aria-label="Foto siguiente"
            >
              Siguiente <ArrowRight size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      </dialog>
    </section>
  );
}

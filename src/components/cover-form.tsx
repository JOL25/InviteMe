'use client';
import { useActionState } from 'react';
import { uploadCover } from '@/actions/cover';
import type { EventState } from '@/actions/events';
import { SubmitButton } from '@/components/submit-button';
export function CoverForm({ id, hasCover }: { id: string; hasCover: boolean }) {
  const [state, action] = useActionState(uploadCover, {} as EventState);
  return (
    <form action={action} className="panel stack cover-form">
      <input type="hidden" name="id" value={id} />
      <div>
        <span className="eyebrow">03 / UNA IMAGEN ESPECIAL</span>
        <h2>La portada.</h2>
        <p className="field-help">
          {hasCover
            ? 'Ya tienes una portada. Puedes reemplazarla aquí.'
            : 'Sin portada, tu invitación usará una ilustración botánica.'}{' '}
          JPG, PNG o WebP, hasta 3 MB.
        </p>
      </div>
      <label>
        Imagen de portada
        <input
          name="cover"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
        />
      </label>
      <SubmitButton pending="Subiendo portada…">
        {hasCover ? 'Reemplazar portada' : 'Subir portada'}
      </SubmitButton>
      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="notice" role="status">
          {state.success}
        </p>
      )}
    </form>
  );
}

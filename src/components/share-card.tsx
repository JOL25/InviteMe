'use client';
import { useState } from 'react';
export function ShareCard({ url }: { url: string }) {
  const [message, setMessage] = useState('');
  return (
    <div className="stack">
      <label>
        Enlace de tu invitación
        <input
          value={url}
          readOnly
          onFocus={(event) => event.currentTarget.select()}
        />
      </label>
      <button
        className="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setMessage('Enlace copiado. ¡A compartir!');
          } catch {
            setMessage('Selecciona el enlace y cópialo manualmente.');
          }
        }}
      >
        Copiar enlace
      </button>
      {message && (
        <p role="status" className="field-help">
          {message}
        </p>
      )}
      <a
        className="text-link"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
      >
        Abrir invitación pública ↗
      </a>
    </div>
  );
}

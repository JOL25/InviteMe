'use client';
import { useEffect, useState } from 'react';
export function Receipt({ slug }: { slug: string }) {
  const [message, setMessage] = useState(
    'Si acabas de enviar tu respuesta, ya puedes cerrar esta página.',
  );
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const raw = sessionStorage.getItem(`inviteme-receipt:${slug}`);
        if (!raw) return;
        const receipt = JSON.parse(raw);
        setMessage(
          receipt.attendance
            ? `¡Te esperamos! Confirmaste para ${receipt.size} ${receipt.size === 1 ? 'persona' : 'personas'}.`
            : 'Gracias por avisarnos. Esperamos compartir otro momento contigo pronto.',
        );
      } catch {
        /* No private data is read from a public URL. */
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [slug]);
  return <p className="muted">{message}</p>;
}

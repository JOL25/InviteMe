'use client';
import { useEffect, useState } from 'react';
import { managementPath, managementFragment } from '@/lib/rsvp-management';
export function Receipt({ slug }: { slug: string }) {
  const [management, setManagement] = useState('');
  const [message, setMessage] = useState(
    'Si acabas de enviar tu respuesta, ya puedes cerrar esta página.',
  );
  useEffect(() => {
    const timer = setTimeout(() => {
      const capability = managementFragment(window.location.hash);
      if (capability) {
        setManagement(managementPath(slug, capability.kind, capability.token));
        return;
      }
      try {
        const raw = sessionStorage.getItem(`inviteme-receipt:${slug}`);
        if (!raw) return;
        const receipt = JSON.parse(raw);
        if (
          ['guest', 'open'].includes(receipt.managementKind) &&
          /^[a-f0-9]{64}$/.test(receipt.managementToken ?? '')
        )
          setManagement(
            managementPath(
              slug,
              receipt.managementKind,
              receipt.managementToken,
            ),
          );
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
  return (
    <div className="stack">
      <p className="muted">{message}</p>
      {management && (
        <>
          <a className="button button-outline" href={management}>
            Gestionar mi respuesta
          </a>
          <p className="field-help">
            Guarda el enlace privado de gestión para editar o cancelar tu
            asistencia.
          </p>
        </>
      )}
    </div>
  );
}

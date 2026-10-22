import Link from 'next/link';
import Image from 'next/image';
import QRCode from 'qrcode';
import { ownedEvent } from '@/lib/events';
import { siteUrl } from '@/lib/env';
import { ShareCard } from '@/components/share-card';
export default async function Share({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { event } = await ownedEvent(id);
  const url = `${siteUrl()}/i/${event.slug}`;
  const qr = event.published_at
    ? await QRCode.toDataURL(url, {
        width: 600,
        margin: 4,
        errorCorrectionLevel: 'M',
        color: { dark: '#18233B', light: '#FFFFFF' },
      })
    : null;
  return (
    <>
      <Link className="back-link" href={`/dashboard/events/${id}/edit`}>
        ← Volver a editar
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">QUE CORRA LA ILUSIÓN</span>
          <h1>Tu invitación, lista para viajar.</h1>
          <p className="muted">{event.title}</p>
        </div>
      </div>
      {!qr ? (
        <section className="panel stack">
          <h2>Aún es un borrador.</h2>
          <p>
            Revisa tu invitación y publícala antes de compartir el enlace o el
            QR.
          </p>
          <Link className="button" href={`/dashboard/events/${id}/edit`}>
            Revisar y publicar
          </Link>
        </section>
      ) : (
        <div className="share-grid">
          <section className="panel stack">
            <h2>Un enlace para todos.</h2>
            <p className="muted">Envíalo por el medio que prefieras.</p>
            <ShareCard url={url} />
          </section>
          <section className="panel qr-panel">
            <Image
              src={qr}
              width={230}
              height={230}
              alt={`Código QR de ${event.title}`}
              unoptimized
            />
            <h2>Escanea y celebra.</h2>
            <p className="field-help">El QR abre tu invitación pública.</p>
            <a
              className="button button-outline"
              href={qr}
              download={`${event.slug}-qr.png`}
            >
              Descargar QR
            </a>
          </section>
        </div>
      )}
    </>
  );
}

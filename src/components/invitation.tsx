import type { CSSProperties } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';
import {
  CalendarDays,
  Clock3,
  MapPin,
  ArrowUpRight,
  Heart,
} from 'lucide-react';
import { Botanical } from '@/components/botanical';
import { Countdown } from '@/components/countdown';
import { RSVPForm } from '@/components/rsvp-form';
import { Brand } from '@/components/brand';
import { ScrollReveal } from '@/components/scroll-reveal';
import { PhotoGallery } from '@/components/photo-gallery';
import { RSVPLink } from '@/components/rsvp-link';
import { categoryLabels } from '@/lib/validators';
import type { PublicEvent } from '@/types/database';
export function Invitation({
  event,
  sample = false,
  preview = false,
}: {
  event: PublicEvent;
  sample?: boolean;
  preview?: boolean;
}) {
  const date = (pattern: string) =>
    formatInTimeZone(event.starts_at, event.timezone, pattern, { locale: es });
  return (
    <div
      className="invitation"
      style={
        {
          '--event-primary': event.primary_color,
          '--event-accent': event.accent_color,
        } as CSSProperties
      }
    >
      <ScrollReveal>
        <section
          className={`invitation-hero ${event.cover_url ? 'has-cover' : ''}`}
        >
          {event.cover_url && (
            /* Permission-checked uploads bypass the optimizer cache. */ <picture className="invitation-cover">
              <img src={event.cover_url} alt="Portada de la celebración" />
            </picture>
          )}
          <Botanical className="invitation-botanical left" />
          <Botanical className="invitation-botanical right" />
          <div className="invitation-hero-content">
            <span className="eyebrow">
              {categoryLabels[event.category]} · UNA FECHA PARA RECORDAR
            </span>
            <Heart className="invitation-heart" size={24} strokeWidth={1} />
            <h1>{event.title}</h1>
            <p className="invitation-date">{date('dd . MM . yyyy')}</p>
            <span className="invitation-divider" />
            <p>Queremos compartir este momento contigo.</p>
            <RSVPLink>
              {event.rsvp_open ? 'Confirmar asistencia' : 'Ver detalles'}{' '}
              <ArrowUpRight size={17} />
            </RSVPLink>
          </div>
        </section>
        <section className="invitation-message" data-reveal>
          <span className="eyebrow">LOS MEJORES MOMENTOS SE COMPARTEN</span>
          <h2>Contigo, será inolvidable.</h2>
          <p>{event.message}</p>
          <div aria-hidden="true" className="small-star">
            ✳
          </div>
        </section>
        <section className="invitation-countdown" data-reveal>
          <span className="eyebrow">CADA VEZ FALTA MENOS</span>
          <Countdown startsAt={event.starts_at} />
        </section>
        <section className="invitation-details">
          <div data-reveal>
            <span className="eyebrow">NOS VEMOS AQUÍ</span>
            <h2>Guarda la fecha.</h2>
          </div>
          <div className="detail-grid">
            <article data-reveal>
              <CalendarDays size={24} strokeWidth={1.2} />
              <h3>El día</h3>
              <p>{date("EEEE d 'de' MMMM")}</p>
              <small>{date('yyyy')}</small>
            </article>
            <article data-reveal data-reveal-delay="1">
              <Clock3 size={24} strokeWidth={1.2} />
              <h3>La hora</h3>
              <p>{date('HH:mm')} h</p>
              <small>{event.timezone}</small>
            </article>
            <article data-reveal data-reveal-delay="2">
              <MapPin size={24} strokeWidth={1.2} />
              <h3>El lugar</h3>
              <p>{event.venue_name}</p>
              <small>{event.venue_address}</small>
              {event.map_url && (
                <a
                  className="text-link"
                  href={event.map_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Abrir mapa ↗
                </a>
              )}
            </article>
          </div>
        </section>
        <PhotoGallery photos={event.gallery} />
        <section className="invitation-rsvp" id="rsvp" data-reveal>
          <span className="eyebrow">TU PRESENCIA ES EL MEJOR REGALO</span>
          <h2>
            {event.rsvp_open
              ? '¿Celebramos juntos?'
              : 'Gracias por acompañarnos.'}
          </h2>
          <p className="muted">
            {event.rsvp_open
              ? 'Cuéntanos si podrás venir. Nos hace ilusión verte.'
              : 'Las confirmaciones de este evento están cerradas.'}
          </p>
          {event.rsvp_open && (
            <RSVPForm slug={event.slug} sample={sample} preview={preview} />
          )}
        </section>
        <footer className="invitation-footer">
          <span>Una invitación hecha con cariño en</span>
          <Brand />
        </footer>
      </ScrollReveal>
    </div>
  );
}

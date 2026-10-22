import Link from 'next/link';
import {
  ArrowUpRight,
  ArrowRight,
  Heart,
  Palette,
  Send,
  Users,
  Check,
  Sparkles,
  QrCode,
} from 'lucide-react';
import { Brand } from '@/components/brand';
import { Botanical } from '@/components/botanical';
const features = [
  {
    icon: Palette,
    title: 'Tan única como tu historia.',
    text: 'Tu portada, tus colores y tus palabras. Una invitación que se siente tuya.',
  },
  {
    icon: Send,
    title: 'Un enlace. Muchas emociones.',
    text: 'Compártela por donde quieras o usa su código QR. Sin imprimir, sin complicaciones.',
  },
  {
    icon: Users,
    title: 'Todo listo para recibirlos.',
    text: 'Recibe confirmaciones y consulta quién viene. Menos listas, más ilusión.',
  },
];
export default function Home() {
  return (
    <>
      <header className="site-header">
        <Brand />
        <nav aria-label="Principal">
          <a className="desktop-nav" href="#como-funciona">
            Cómo funciona
          </a>
          <a className="desktop-nav" href="#detalles">
            Los detalles
          </a>
          <Link className="text-link" href="/login">
            Iniciar sesión
          </Link>
          <Link className="button header-cta" href="/register">
            Crear invitación <ArrowUpRight size={15} />
          </Link>
        </nav>
      </header>
      <main id="main">
        <section className="marketing-hero">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="tiny-star">✳</span> PEQUEÑOS DETALLES. GRANDES
              MOMENTOS.
            </span>
            <h1>
              Hay momentos
              <br />
              que merecen
              <br />
              <em>una invitación.</em>
            </h1>
            <p>
              Reúne a tus personas favoritas con una invitación tan especial
              como lo que están por celebrar.
            </p>
            <div className="hero-actions">
              <Link className="button" href="/register">
                Crear mi invitación <ArrowUpRight size={17} />
              </Link>
              <Link className="sample-link" href="/ejemplo">
                Ver un ejemplo <ArrowRight size={16} />
              </Link>
            </div>
            <div className="hero-footnote">
              <Check size={14} />
              <span>A tu estilo</span>
              <span className="footnote-dot">·</span>
              <Check size={14} />
              <span>Lista para compartir</span>
            </div>
          </div>
          <div className="hero-art">
            <span className="art-orbit" />
            <div className="sample-invitation">
              <Botanical className="card-botanical botanical-one" />
              <Botanical className="card-botanical botanical-two" />
              <span className="eyebrow">¡NOS CASAMOS!</span>
              <span className="sample-heart">
                <Heart size={18} strokeWidth={1} />
              </span>
              <p className="sample-names">
                Valentina
                <br />
                <span>&</span>
                <br />
                Mateo
              </p>
              <span className="sample-rule" />
              <p className="sample-date">18 . 06 . 2027</p>
              <p className="sample-location">Jardín de los Olivos · Lima</p>
              <span className="sample-card-cta">Celebremos juntos ↗</span>
            </div>
            <span className="floating-note">
              <Sparkles size={16} strokeWidth={1.2} />
              Un comienzo inolvidable
            </span>
            <div className="floating-rsvp">
              <span className="rsvp-check">
                <Check size={16} />
              </span>
              <div>
                <strong>¡Ahí estaremos!</strong>
                <span>Así de fácil es confirmar.</span>
              </div>
              <Heart size={15} strokeWidth={1.4} />
            </div>
            <span className="art-caption">TU HISTORIA, EN CADA DETALLE.</span>
          </div>
        </section>
        <div className="occasion-strip">
          <span>PARA TODO LO QUE MERECE CELEBRARSE</span>
          <div>
            <span>Bodas</span>
            <i>✳</i>
            <span>Cumpleaños</span>
            <i>✳</i>
            <span>Graduaciones</span>
            <i>✳</i>
            <span>Y nuevos comienzos</span>
          </div>
        </div>
        <section className="marketing-section" id="detalles">
          <div className="section-heading">
            <span className="eyebrow">LA ILUSIÓN ESTÁ EN LOS DETALLES</span>
            <h2>
              Menos preparativos.
              <br />
              <em>Más ganas de celebrar.</em>
            </h2>
            <p className="muted">
              Desde el primer «estás invitado» hasta el último «ahí estaré».
            </p>
          </div>
          <div className="feature-grid">
            {features.map(({ icon: Icon, title, text }, i) => (
              <article key={title}>
                <span className="feature-number">0{i + 1}</span>
                <Icon size={30} strokeWidth={1.1} />
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="how-section" id="como-funciona">
          <div className="how-intro">
            <span className="eyebrow">SENCILLO, COMO DEBE SER</span>
            <h2>
              De una idea
              <br />a un <em>«te esperamos».</em>
            </h2>
            <p className="muted">
              Tú tienes el motivo. InviteMe te ayuda a compartirlo.
            </p>
            <Link className="text-link" href="/ejemplo">
              Explorar la invitación de ejemplo ↗
            </Link>
          </div>
          <ol className="steps">
            {[
              [
                'Cuéntanos qué celebras.',
                'Añade la fecha, el lugar y los detalles de tu evento.',
              ],
              [
                'Ponle un poco de ti.',
                'Elige tus colores, sube una foto y escribe ese mensaje especial.',
              ],
              [
                'Comparte la emoción.',
                'Publica, envía tu enlace o QR y recibe las confirmaciones.',
              ],
            ].map(([title, text], index) => (
              <li key={title}>
                <span>0{index + 1}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section className="template-section">
          <div className="template-art">
            <Botanical />
            <span className="serif">
              Hecha para
              <br />
              <em>tu momento.</em>
            </span>
            <span className="template-tag">LA COLECCIÓN · CLÁSICA</span>
          </div>
          <div>
            <span className="eyebrow">
              UN DISEÑO QUE DEJA HABLAR A TU HISTORIA
            </span>
            <h2>
              Elegante por fuera.
              <br />
              <em>Muy tuya por dentro.</em>
            </h2>
            <p className="muted">
              Una plantilla cuidada que se adapta a tu celebración. Cambia la
              portada, el mensaje y la paleta; conserva la esencia.
            </p>
            <ul className="template-list">
              <li>
                <Check size={16} />
                Se ve hermosa en el teléfono
              </li>
              <li>
                <QrCode size={16} />
                Enlace y QR listos para compartir
              </li>
              <li>
                <Heart size={16} />
                Respuestas en un solo lugar
              </li>
            </ul>
            <Link className="button button-outline" href="/ejemplo">
              Conocer la plantilla <ArrowUpRight size={17} />
            </Link>
          </div>
        </section>
        <section className="faq-section">
          <div>
            <span className="eyebrow">POR SI TE LO PREGUNTABAS</span>
            <h2>Antes del gran día.</h2>
          </div>
          <div className="faq-list">
            {[
              [
                '¿Necesitan una cuenta mis invitados?',
                'No. Tus invitados abren el enlace o escanean el QR y pueden confirmar desde el teléfono, sin registrarse.',
              ],
              [
                '¿Puedo editar después de publicar?',
                'Sí. Puedes actualizar los detalles y el diseño de tu invitación. El enlace sigue siendo el mismo.',
              ],
              [
                '¿Puedo limitar la cantidad de asistentes?',
                'Sí. Configura la capacidad del evento y las confirmaciones respetarán ese límite. También puedes cerrar las respuestas cuando lo necesites.',
              ],
              [
                '¿Cómo comparto mi invitación?',
                'Una vez publicada, copia su enlace o descarga el código QR desde tu panel. Tú eliges cómo enviarla.',
              ],
            ].map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q}
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="final-cta">
          <Botanical />
          <span className="eyebrow">QUE EMPIECE LO BONITO</span>
          <h2>
            Tu próximo gran momento
            <br />
            <em>empieza aquí.</em>
          </h2>
          <p>Hazle un lugar en la agenda de quienes más quieres.</p>
          <Link className="button button-light" href="/register">
            Crear mi invitación <ArrowUpRight size={17} />
          </Link>
        </section>
      </main>
      <footer className="marketing-footer">
        <Brand />
        <p>Hecho para reunir a quienes más quieres.</p>
        <span>© {new Date().getFullYear()} InviteMe</span>
      </footer>
    </>
  );
}

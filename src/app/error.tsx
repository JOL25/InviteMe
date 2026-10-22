'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="empty-state">
      <h1>No pudimos cargar esta página.</h1>
      <p className="muted">Inténtalo de nuevo en unos momentos.</p>
      <button className="button" onClick={reset}>
        Volver a intentar
      </button>
    </main>
  );
}

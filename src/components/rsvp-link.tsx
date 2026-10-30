'use client';
export function RSVPLink({ children }: { children: React.ReactNode }) {
  return (
    <a
      className="button"
      href="#rsvp"
      onClick={(event) => {
        if (window.location.hash.startsWith('#invitado=')) {
          event.preventDefault();
          document.getElementById('rsvp')?.scrollIntoView({
            behavior:
              document.documentElement.dataset.siteMotion === 'full'
                ? 'smooth'
                : 'instant',
          });
        }
      }}
    >
      {children}
    </a>
  );
}

'use client';

import { useEffect, useRef } from 'react';

/** Progressive enhancement: server content is visible without JS or motion. */
export function ScrollReveal({ children }: { children: React.ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = scope.current;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!root || preference.matches || !('IntersectionObserver' in window))
      return;

    const elements = Array.from(
      root.querySelectorAll<HTMLElement>('[data-reveal]'),
    );
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.motion = 'visible';
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px 64px 0px', threshold: 0.06 },
    );

    for (const element of elements) {
      // Never hide content the user is already looking at, including a hash
      // destination restored by navigation or a page restored mid-scroll.
      if (element.getBoundingClientRect().top < window.innerHeight) continue;
      element.dataset.motion = 'pending';
      observer.observe(element);
    }

    const clear = () => {
      observer.disconnect();
      elements.forEach((element) => delete element.dataset.motion);
    };
    const onPreferenceChange = () => {
      if (preference.matches) clear();
    };
    preference.addEventListener('change', onPreferenceChange);
    return () => {
      clear();
      preference.removeEventListener('change', onPreferenceChange);
    };
  }, []);

  return (
    <div className="motion-scope" ref={scope}>
      {children}
    </div>
  );
}

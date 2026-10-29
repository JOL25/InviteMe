'use client';

import { useEffect, useRef } from 'react';
import { useMotion } from '@/components/motion-provider';

/** Progressive enhancement: server content is visible without JS or motion. */
export function ScrollReveal({ children }: { children: React.ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);
  const enabled = useMotion();

  useEffect(() => {
    const root = scope.current;
    if (!root || !enabled || !('IntersectionObserver' in window)) return;

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
    return clear;
  }, [enabled]);

  return (
    <div className="motion-scope" ref={scope}>
      {children}
    </div>
  );
}

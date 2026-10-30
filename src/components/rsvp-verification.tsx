'use client';
import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';
export function RSVPVerification({
  onToken,
}: {
  onToken: (token: string) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  useEffect(() => {
    if (!sitekey || !loaded || !container.current || !window.turnstile) return;
    const id = window.turnstile.render(container.current, {
      sitekey,
      action: 'rsvp',
      callback: onToken,
      'expired-callback': () => onToken(''),
      'error-callback': () => onToken(''),
    });
    return () => window.turnstile?.remove(id);
  }, [loaded, sitekey, onToken]);
  if (!sitekey) return null;
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        onReady={() => setLoaded(true)}
      />
      <div ref={container} />
    </>
  );
}

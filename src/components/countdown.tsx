'use client';
import { useEffect, useState } from 'react';
export function Countdown({ startsAt }: { startsAt: string }) {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    const timer = setInterval(
      () =>
        setRemaining(Math.max(0, new Date(startsAt).getTime() - Date.now())),
      1000,
    );
    return () => clearInterval(timer);
  }, [startsAt]);
  if (remaining === 0)
    return <p className="countdown-arrived">¡Llegó el gran día!</p>;
  const values =
    remaining === null
      ? ['—', '—', '—', '—']
      : [
          Math.floor(remaining / 86400000),
          Math.floor(remaining / 3600000) % 24,
          Math.floor(remaining / 60000) % 60,
          Math.floor(remaining / 1000) % 60,
        ].map((v) => String(v).padStart(2, '0'));
  return (
    <div className="countdown" aria-label="Tiempo hasta el evento">
      {['Días', 'Horas', 'Minutos', 'Segundos'].map((label, index) => (
        <div key={label}>
          <span>{values[index]}</span>
          <small>{label}</small>
        </div>
      ))}
    </div>
  );
}

'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
  type MouseEvent,
} from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

type Preference = 'auto' | 'full' | 'reduce';
const key = 'inviteme-motion';
let fallback: Preference = 'auto';
function preference(): Preference {
  try {
    const value = localStorage.getItem(key);
    return value === 'full' || value === 'reduce' ? value : 'auto';
  } catch {
    return fallback;
  }
}
function subscribePreference(notify: () => void) {
  window.addEventListener('storage', notify);
  window.addEventListener('inviteme:motion', notify);
  return () => {
    window.removeEventListener('storage', notify);
    window.removeEventListener('inviteme:motion', notify);
  };
}
function savePreference(value: Preference) {
  fallback = value;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* In-memory choice still works. */
  }
  window.dispatchEvent(new Event('inviteme:motion'));
}
function subscribeSystem(notify: () => void) {
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
}
const subscribeHydration = () => () => {};
const MotionContext = createContext(false);
export const useMotion = () => useContext(MotionContext);

export function MotionProvider({ children }: { children: React.ReactNode }) {
  const choice = useSyncExternalStore(
    subscribePreference,
    preference,
    () => 'auto' as Preference,
  );
  const reduced = useSyncExternalStore(
    subscribeSystem,
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => true,
  );
  const hydrated = useSyncExternalStore(
    subscribeHydration,
    () => true,
    () => false,
  );
  const enabled = choice === 'full' || (choice === 'auto' && !reduced);
  const frames = useRef<number[]>([]);
  const waves = useRef(new Map<HTMLElement, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const root = document.documentElement;
    frames.current.forEach(cancelAnimationFrame);
    root.dataset.siteMotion = enabled ? 'full' : 'reduce';
    const activeWaves = waves.current;
    return () => {
      frames.current.forEach(cancelAnimationFrame);
      activeWaves.forEach((timer, wave) => {
        clearTimeout(timer);
        wave.remove();
      });
      activeWaves.clear();
      delete root.dataset.siteMotion;
    };
  }, [enabled]);
  function replay() {
    if (!enabled) return;
    frames.current.forEach(cancelAnimationFrame);
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.documentElement.dataset.siteMotion = 'replay';
    frames.current = [
      requestAnimationFrame(() => {
        frames.current.push(
          requestAnimationFrame(() => {
            document.documentElement.dataset.siteMotion = 'full';
          }),
        );
      }),
    ];
  }
  function click(event: MouseEvent<HTMLDivElement>) {
    if (!enabled || !(event.target instanceof Element)) return;
    const target = event.target.closest<HTMLElement>(
      'button:not(:disabled), a.button, summary, .attendance-options label',
    );
    if (!target || target.closest('.motion-controls')) return;
    const rect = target.getBoundingClientRect();
    const wave = document.createElement('span');
    wave.className = 'click-wave';
    wave.setAttribute('aria-hidden', 'true');
    const size = Math.max(rect.width, rect.height) * 2;
    wave.style.width = wave.style.height = `${size}px`;
    wave.style.left = `${event.detail ? event.clientX - rect.left : rect.width / 2}px`;
    wave.style.top = `${event.detail ? event.clientY - rect.top : rect.height / 2}px`;
    target.append(wave);
    const remove = () => {
      clearTimeout(waves.current.get(wave));
      waves.current.delete(wave);
      wave.remove();
    };
    wave.addEventListener('animationend', remove, { once: true });
    waves.current.set(wave, setTimeout(remove, 1000));
  }
  return (
    <MotionContext value={enabled}>
      <div className="motion-app" onClickCapture={click}>
        {children}
      </div>
      {hydrated && (
        <div
          className="motion-controls"
          role="group"
          aria-label="Animaciones de la página"
        >
          <button
            type="button"
            aria-label={
              enabled ? 'Desactivar animaciones' : 'Activar animaciones'
            }
            aria-pressed={enabled}
            onClick={() => savePreference(enabled ? 'reduce' : 'full')}
          >
            {enabled ? (
              <Pause size={14} aria-hidden="true" />
            ) : (
              <Play size={14} aria-hidden="true" />
            )}
            {enabled ? 'Animaciones activadas' : 'Activar animaciones'}
          </button>
          <button
            type="button"
            onClick={replay}
            disabled={!enabled}
            aria-label="Repetir animación de entrada"
          >
            <RotateCcw size={14} aria-hidden="true" /> Repetir entrada
          </button>
        </div>
      )}
    </MotionContext>
  );
}

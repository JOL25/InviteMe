'use client';
import { useFormStatus } from 'react-dom';
export function SubmitButton({
  children,
  pending = 'Guardando…',
  className = 'button',
  disabled = false,
}: {
  children: React.ReactNode;
  pending?: string;
  className?: string;
  disabled?: boolean;
}) {
  const status = useFormStatus();
  return (
    <button
      className={className}
      disabled={disabled || status.pending}
      type="submit"
    >
      {status.pending ? pending : children}
    </button>
  );
}

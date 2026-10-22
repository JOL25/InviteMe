import Link from 'next/link';
import { Sparkles } from 'lucide-react';
export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="InviteMe, inicio">
      <Sparkles size={23} strokeWidth={1.4} />
      <span>
        Invite<span className="brand-accent">Me</span>
        <span className="brand-dot">.</span>
      </span>
    </Link>
  );
}

import { z } from 'zod';
import { invitationTokenSchema } from '@/lib/invite-rules';
export const managementLookupSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,150}$/),
  kind: z.enum(['open', 'guest']),
  token: invitationTokenSchema,
});
export const managementWriteSchema = managementLookupSchema.extend({
  revision: z.number().int().min(1).max(2147483646),
  intent: z.enum(['update', 'cancel']),
  guestName: z.string().trim().min(2).max(120),
  guestEmail: z.union([z.literal(''), z.email().max(254)]).default(''),
  attendance: z.boolean(),
  partySize: z.number().int().min(1).max(10),
  note: z.string().trim().max(500).default(''),
  website: z.literal('').default(''),
  turnstileToken: z.string().max(2048).optional(),
});
export type ManagedReply = {
  id: string;
  guest_name: string;
  guest_email: string;
  attendance: boolean;
  party_size: number;
  note: string;
  revision: number;
  cancelled: boolean;
  max_party_size: number;
  rsvp_open: boolean;
};
export function managementFragment(
  hash: string,
): { kind: 'guest' | 'open'; token: string } | null {
  const kind = hash.startsWith('#invitado=')
    ? 'guest'
    : hash.startsWith('#respuesta=')
      ? 'open'
      : null;
  const token = hash.slice(hash.indexOf('=') + 1);
  return kind && invitationTokenSchema.safeParse(token).success
    ? { kind, token }
    : null;
}
export function managementPath(
  slug: string,
  kind: 'guest' | 'open',
  token: string,
) {
  return `/i/${slug}/manage#${kind === 'guest' ? 'invitado' : 'respuesta'}=${token}`;
}

import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
export function guestToken(
  id: string,
  nonce: string,
  secret = process.env.INVITATION_LINK_SECRET,
) {
  if (!secret || secret.length < 32)
    throw new Error('Falta configurar INVITATION_LINK_SECRET.');
  return createHmac('sha256', secret)
    .update(`inviteme:guest:v1:${id}:${nonce}`)
    .digest('hex');
}
export function guestTokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
export function tokenMatches(token: string, hash: string) {
  if (!/^[a-f0-9]{64}$/.test(hash)) return false;
  return timingSafeEqual(
    Buffer.from(guestTokenHash(token), 'hex'),
    Buffer.from(hash, 'hex'),
  );
}

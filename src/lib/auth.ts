import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { query } from '@/lib/db';
import { hasDatabase, siteUrl } from '@/lib/env';
export const sessionCookie = 'inviteme_session';
export const tokenHash = (token: string) =>
  createHash('sha256').update(token).digest('hex');
export const currentUser = cache(async () => {
  if (!hasDatabase()) return null;
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const { rows } = await query<{ id: string; email: string }>(
    `select u.id,u.email from app_users u join app_sessions s on s.user_id=u.id
     where s.token_hash=$1 and s.expires_at>now()`,
    [tokenHash(token)],
  );
  return rows[0] ?? null;
});
export async function createSession(userId: string) {
  const token = randomBytes(32).toString('hex');
  await query('delete from app_sessions where expires_at <= now()');
  await query(
    `insert into app_sessions(token_hash,user_id,expires_at)
    values($1,$2,now()+interval '7 days')`,
    [tokenHash(token), userId],
  );
  (await cookies()).set(sessionCookie, token, {
    httpOnly: true,
    secure: new URL(siteUrl()).protocol === 'https:',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });
}
export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(sessionCookie)?.value;
  if (token && hasDatabase())
    await query('delete from app_sessions where token_hash=$1', [
      tokenHash(token),
    ]);
  jar.delete(sessionCookie);
}
export async function requireUser() {
  if (!hasDatabase()) redirect('/login?setup=1');
  const user = await currentUser();
  if (!user) redirect('/login');
  return { user };
}

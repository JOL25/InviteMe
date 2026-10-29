import 'server-only';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { findOwnedEvent } from '@/lib/event-store';
export async function ownedEvent(id: string) {
  const { user } = await requireUser();
  if (!z.uuid().safeParse(id).success) notFound();
  const data = await findOwnedEvent(id, user.id);
  if (!data) notFound();
  return { event: data, user };
}

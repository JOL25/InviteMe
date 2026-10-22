import 'server-only';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
export async function ownedEvent(id: string) {
  const { supabase, user } = await requireUser();
  if (!z.uuid().safeParse(id).success) notFound();
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .eq('owner_id', user.id)
    .maybeSingle();
  if (error)
    throw new Error('No pudimos cargar el evento. Inténtalo de nuevo.');
  if (!data) notFound();
  return { event: data, supabase, user };
}

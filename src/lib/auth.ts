import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { hasSupabase } from '@/lib/env';
export async function requireUser() {
  if (!hasSupabase()) redirect('/login?setup=1');
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect('/login');
  return { supabase, user: data.user };
}

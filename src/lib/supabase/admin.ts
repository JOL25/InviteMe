import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { publicConfig } from '@/lib/env';
import type { Database } from '@/types/database';
export function createAdminClient() {
  const { url } = publicConfig();
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error('Falta la clave de servidor de Supabase.');
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

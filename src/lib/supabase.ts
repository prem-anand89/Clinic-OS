import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, hasSupabaseConfig } from './env';

let client: SupabaseClient | null = null;

/** Null when the app has no Supabase config (e.g. fresh checkout without .env). */
export function getSupabase(): SupabaseClient | null {
  if (!hasSupabaseConfig) return null;
  if (!client) {
    client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: {
        // Session persists in localStorage so the app reopens offline
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return client;
}

import { createClient } from '@supabase/supabase-js';

/**
 * Service-role client — server-side only. Required for creating/managing users.
 * Add SUPABASE_SERVICE_ROLE_KEY to .env (Supabase Dashboard → Settings → API).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

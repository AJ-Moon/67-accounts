import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Lazily-created shared client.
 * The client is only constructed on first actual use (at runtime), NOT at
 * import time — so `next build` works even in environments where the
 * NEXT_PUBLIC_SUPABASE_* variables aren't injected during the build step.
 */
let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error(
        'Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (in .env locally, or in your hosting provider\'s environment settings).'
      );
    }
    client = createClient(url, key);
  }
  return client;
}

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const c = getClient();
    const value = (c as any)[prop];
    return typeof value === 'function' ? value.bind(c) : value;
  },
});

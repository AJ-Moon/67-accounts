import { supabase } from '@/lib/supabase';

/**
 * Validate an external API key from the `x-api-key` header.
 * Keys are managed in Settings → API Keys (api_keys table).
 * EXTERNAL_ORDER_API_KEY env is still honored for backwards compatibility.
 */
export async function validateApiKey(request: Request): Promise<{ ok: boolean; name?: string }> {
  const apiKey = request.headers.get('x-api-key');
  if (!apiKey) return { ok: false };

  if (process.env.EXTERNAL_ORDER_API_KEY && apiKey === process.env.EXTERNAL_ORDER_API_KEY) {
    return { ok: true, name: 'env-key' };
  }

  const { data } = await supabase
    .from('api_keys')
    .select('id, name')
    .eq('key', apiKey)
    .eq('isActive', true)
    .maybeSingle();

  if (!data) return { ok: false };

  supabase.from('api_keys').update({ lastUsedAt: new Date().toISOString() }).eq('id', data.id)
    .then(() => {}, () => {});
  return { ok: true, name: data.name };
}

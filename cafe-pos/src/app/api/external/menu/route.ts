import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { validateApiKey } from '@/lib/apiAuth';

/** GET /api/external/menu — full available menu for websites/apps. */
export async function GET(request: Request) {
  const auth = await validateApiKey(request);
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized: Invalid or missing API Key' }, { status: 401 });

  const { data, error } = await supabase
    .from('items')
    .select('id, name, category, subcategory, size, variant, price, allowUpsize, upsizePrice, isAvailable')
    .eq('isAvailable', true)
    .order('category')
    .order('name');
  if (error) return NextResponse.json({ error: 'Failed to fetch menu' }, { status: 500 });

  return NextResponse.json({ items: data || [] });
}

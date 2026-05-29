import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

function normalizeCategory(category: string) {
  if (!category) return 'Food';
  const c = category.toString().toLowerCase().trim();
  if (c === 'drink' || c === 'drinks') return 'Drinks';
  if (c === 'food') return 'Food';
  return category.trim();
}

export async function GET() {
  try {
    const { data: items, error } = await supabase
      .from('items')
      .select('*')
      .order('category', { ascending: true })
      .order('subcategory', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;

    return NextResponse.json((items || []).map(item => ({
      ...item,
      category: normalizeCategory(item.category),
      subcategory: item.subcategory || item.sub_category || null,
      isAvailable: item.isAvailable ?? item.is_available ?? true,
      allowUpsize: item.allowUpsize ?? item.allow_upsize ?? false,
      upsizePrice: item.upsizePrice ?? item.upsize_price ?? 0,
      optionsConfig: item.optionsConfig ?? item.options_config ?? null
    })));
  } catch (error) {
    console.error('GET /api/items error', error);
    return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabaseServer = await createClient();
    const { data: { user } } = await supabaseServer.auth.getUser();
    const { data: profile } = await supabaseServer.from('profiles').select('role').eq('id', user?.id).single();
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const json = await request.json();
    const { data: item, error } = await supabase
      .from('items')
      .insert({
        name: json.name,
        category: normalizeCategory(json.category),
        subcategory: json.subcategory || null,
        size: json.size || null,
        variant: json.variant || null,
        price: parseFloat(json.price),
        isAvailable: json.isAvailable ?? true,
        allowUpsize: json.allowUpsize ?? false,
        upsizePrice: parseFloat(json.upsizePrice) || 0,
        optionsConfig: json.optionsConfig || null
      })
      .select()
      .single();

    if (error) throw error;
    
    return NextResponse.json(item);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create item' }, { status: 500 });
  }
}

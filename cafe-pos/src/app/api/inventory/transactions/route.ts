import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const ingredientId = url.searchParams.get('ingredientId');

    let query = supabase
      .from('inventory_transactions')
      .select('*, ingredient:ingredients(name, unit)')
      .order('createdAt', { ascending: false })
      .limit(300);
    if (ingredientId) query = query.eq('ingredientId', ingredientId);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}

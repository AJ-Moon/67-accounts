import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createClient } from '@/utils/supabase/server';

/** Record wastage: stock goes down (trackable) and a wastage log is kept.
 *  Body: { ingredientId, quantity, reason } */
export async function POST(request: Request) {
  try {
    const supabaseServer = await createClient();
    const { data: { user } } = await supabaseServer.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { ingredientId, quantity, reason } = await request.json();
    const qty = Number(quantity);
    if (!ingredientId || !(qty > 0)) {
      return NextResponse.json({ error: 'ingredientId and positive quantity required' }, { status: 400 });
    }

    const { data: ingredient } = await supabase.from('ingredients').select('*').eq('id', ingredientId).single();
    if (!ingredient) return NextResponse.json({ error: 'Ingredient not found' }, { status: 404 });

    if (ingredient.isTrackable) {
      await supabase.rpc('adjust_stock', { p_ingredient: ingredientId, p_delta: -qty });
    }

    const { error } = await supabase.from('inventory_transactions').insert({
      ingredientId, type: 'wastage', quantity: -qty,
      unitCost: Number(ingredient.costPerUnit || 0),
      reason: reason || 'Wastage', createdBy: user.id,
    });
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to record wastage' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('v_wastage')
      .select('*')
      .order('createdAt', { ascending: false })
      .limit(200);
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch wastage' }, { status: 500 });
  }
}

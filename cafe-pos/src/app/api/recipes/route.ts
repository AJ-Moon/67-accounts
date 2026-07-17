import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/** GET /api/recipes?itemId=... → recipe lines for a menu item (or all). */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const itemId = url.searchParams.get('itemId');

    let query = supabase
      .from('recipes')
      .select('*, ingredient:ingredients(id, name, unit, isTrackable, currentStock)');
    if (itemId) query = query.eq('itemId', itemId);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch recipes' }, { status: 500 });
  }
}

/** POST { itemId, lines: [{ ingredientId, quantity, upsizeExtra? }] }
 *  Replaces the full recipe for a menu item. Empty lines = no recipe. */
export async function POST(request: Request) {
  try {
    const { itemId, lines } = await request.json();
    if (!itemId || !Array.isArray(lines)) {
      return NextResponse.json({ error: 'itemId and lines[] required' }, { status: 400 });
    }
    for (const l of lines) {
      if (!l.ingredientId || !(Number(l.quantity) > 0)) {
        return NextResponse.json({ error: 'Each line needs ingredientId and positive quantity' }, { status: 400 });
      }
    }

    const { error: delErr } = await supabase.from('recipes').delete().eq('itemId', itemId);
    if (delErr) throw delErr;

    if (lines.length > 0) {
      const { error: insErr } = await supabase.from('recipes').insert(
        lines.map((l: any) => ({
          itemId,
          ingredientId: l.ingredientId,
          quantity: Number(l.quantity),
          upsizeExtra: Number(l.upsizeExtra || 0),
        }))
      );
      if (insErr) throw insErr;
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to save recipe' }, { status: 500 });
  }
}

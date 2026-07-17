import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const json = await request.json();
    const patch: any = { updatedAt: new Date().toISOString() };
    for (const k of ['name', 'unit', 'isTrackable', 'lowStockThreshold', 'costPerUnit', 'isActive'] as const) {
      if (json[k] !== undefined) patch[k] = json[k];
    }
    // Manual stock adjustment (stock-take correction)
    if (json.currentStock !== undefined) {
      const { data: current } = await supabase.from('ingredients').select('currentStock').eq('id', id).single();
      const delta = Number(json.currentStock) - Number(current?.currentStock || 0);
      if (delta !== 0) {
        await supabase.from('inventory_transactions').insert({
          ingredientId: id, type: 'adjustment', quantity: delta,
          reason: json.adjustReason || 'Manual stock adjustment',
        });
      }
      patch.currentStock = Number(json.currentStock);
    }

    const { data, error } = await supabase.from('ingredients').update(patch).eq('id', id).select().single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to update ingredient' }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    // Soft delete: keeps historical transactions intact
    const { error } = await supabase.from('ingredients').update({ isActive: false }).eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete ingredient' }, { status: 500 });
  }
}

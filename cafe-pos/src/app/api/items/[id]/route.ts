import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createClient } from '@/utils/supabase/server';

function normalizeCategory(category: string) {
  if (!category) return 'Food';
  const c = category.toString().toLowerCase();
  if (c === 'drink' || c === 'drinks') return 'Drinks';
  if (c === 'food') return 'Food';
  return category;
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabaseServer = await createClient();
    const { data: { user } } = await supabaseServer.auth.getUser();
    const { data: profile } = await supabaseServer.from('profiles').select('role').eq('id', user?.id).single();
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;
    const json = await request.json();
    
    // Filter undefined keys
    const updateData: any = {
      name: json.name,
      category: normalizeCategory(json.category),
      subcategory: json.subcategory || null,
      size: json.size || null,
      variant: json.variant || null,
    };
    if (json.price !== undefined) updateData.price = parseFloat(json.price);
    if (json.isAvailable !== undefined) updateData.isAvailable = json.isAvailable;
    if (json.allowUpsize !== undefined) updateData.allowUpsize = json.allowUpsize;
    if (json.upsizePrice !== undefined) updateData.upsizePrice = parseFloat(json.upsizePrice);
    if (json.optionsConfig !== undefined) updateData.optionsConfig = json.optionsConfig || null;

    const { data: item, error } = await supabase
      .from('items')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    
    return NextResponse.json(item);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { error } = await supabase
      .from('items')
      .delete()
      .eq('id', id);

    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('ingredients')
      .select('*')
      .order('name');
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch ingredients' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    if (!json.name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const { data, error } = await supabase
      .from('ingredients')
      .insert({
        name: json.name.trim(),
        unit: json.unit || 'pcs',
        isTrackable: json.isTrackable !== false,
        currentStock: Number(json.currentStock || 0),
        lowStockThreshold: Number(json.lowStockThreshold || 0),
        costPerUnit: Number(json.costPerUnit || 0),
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e: any) {
    const msg = e?.code === '23505' ? 'Ingredient already exists' : 'Failed to create ingredient';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

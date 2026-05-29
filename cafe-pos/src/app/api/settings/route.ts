import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data: settings, error } = await supabase.from('settings').select('*').single();
    if (error && error.code !== 'PGRST116') throw error; // PGRST116 means no rows return
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const json = await request.json();
    const { data: settings, error } = await supabase
      .from('settings')
      .update({
        shopName: json.shopName,
        address: json.address,
        phone: json.phone,
        footerMessage: json.footerMessage,
        printerType: json.printerType,
        printerAddress: json.printerAddress,
      })
      .eq('id', 1)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}

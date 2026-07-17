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
    
    // Attempt to locate any single existing settings row securely
    const { data: existing } = await supabase.from('settings').select('id').limit(1).single();
    
    let settingsData;
    let settingsError;

    if (existing) {
      const { data, error } = await supabase
        .from('settings')
        .update({
          shopName: json.shopName,
          address: json.address,
          phone: json.phone,
          footerMessage: json.footerMessage,
          printerType: json.printerType,
          printerAddress: json.printerAddress,
          taxEnabled: json.taxEnabled === true,
          taxInclusive: json.taxInclusive === true,
        })
        .eq('id', existing.id)
        .select()
        .single();
        settingsData = data;
        settingsError = error;
    } else {
      const { data, error } = await supabase
        .from('settings')
        .insert({
          shopName: json.shopName,
          address: json.address,
          phone: json.phone,
          footerMessage: json.footerMessage,
          printerType: json.printerType,
          printerAddress: json.printerAddress,
          taxEnabled: json.taxEnabled === true,
          taxInclusive: json.taxInclusive === true,
        })
        .select()
        .single();
        settingsData = data;
        settingsError = error;
    }

    if (settingsError) throw settingsError;
    return NextResponse.json(settingsData);
  } catch (error: any) {
    console.error('Settings save error', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}

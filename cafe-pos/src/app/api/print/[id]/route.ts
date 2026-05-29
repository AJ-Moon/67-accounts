import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { printReceipts } from '@/lib/printer';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    // Fetch the order and items
    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        *,
        items:order_items(*)
      `)
      .eq('id', parseInt(id))
      .single();

    if (error || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    let { data: settings } = await supabase.from('settings').select('*').single();
    if (!settings) {
      settings = { id: 1, shopName: '67', address: '', phone: '', footerMessage: 'Thank you for visiting 67', printerType: 'USB', printerAddress: '' };
    }

    const printSuccess = await printReceipts(order as any, settings);

    if (printSuccess) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Failed to connect to printer' }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Print failed' }, { status: 500 });
  }
}

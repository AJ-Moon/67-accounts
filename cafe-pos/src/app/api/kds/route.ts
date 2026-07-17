import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/** GET /api/kds?station=kitchen|bar → active orders containing pending items for that station. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const station = url.searchParams.get('station');
    if (!station || !['kitchen', 'bar'].includes(station)) {
      return NextResponse.json({ error: 'station must be kitchen or bar' }, { status: 400 });
    }

    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, orderNumber, orderType, customerName, status, createdAt, items:order_items(*)')
      .in('status', ['placed', 'getting_ready'])
      .order('createdAt', { ascending: true });
    if (error) throw error;

    const result = (orders || [])
      .map((o: any) => ({
        ...o,
        items: (o.items || []).filter((i: any) => i.station === station),
      }))
      .filter((o: any) => o.items.length > 0);

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch KDS orders' }, { status: 500 });
  }
}

/** POST { orderId, station, itemId? } → mark one item (or the whole station's items) ready. */
export async function POST(request: Request) {
  try {
    const { orderId, station, itemId, undo } = await request.json();
    if (!orderId || !['kitchen', 'bar'].includes(station)) {
      return NextResponse.json({ error: 'orderId and valid station required' }, { status: 400 });
    }

    let query = supabase
      .from('order_items')
      .update({ stationStatus: undo ? 'pending' : 'ready' })
      .eq('orderId', orderId)
      .eq('station', station);
    if (itemId) query = query.eq('id', itemId);

    const { error } = await query;
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to update item status' }, { status: 500 });
  }
}

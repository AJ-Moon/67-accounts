import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { validateApiKey } from '@/lib/apiAuth';

/** GET /api/external/orders/{id} — order status for websites/apps. Accepts order id or orderNumber. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await validateApiKey(request);
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized: Invalid or missing API Key' }, { status: 401 });

  const { id } = await params;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  const { data: order } = await supabase
    .from('orders')
    .select('id, orderNumber, status, orderType, subtotal, discountAmount, tax, taxRate, finalTotal, paymentMethod, createdAt, updatedAt, items:order_items(name, quantity, price, totalPrice, notes, station, stationStatus)')
    .eq(isUuid ? 'id' : 'orderNumber', id)
    .maybeSingle();

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  return NextResponse.json({ order });
}

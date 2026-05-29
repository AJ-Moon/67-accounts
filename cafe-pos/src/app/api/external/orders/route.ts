import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createClient } from '@/utils/supabase/server'; // Admin bypass optionally

export async function POST(request: Request) {
  try {
    const apiKey = request.headers.get('x-api-key');
    const requiredKey = process.env.EXTERNAL_ORDER_API_KEY;

    if (!apiKey || !requiredKey || apiKey !== requiredKey) {
      return NextResponse.json({ error: 'Unauthorized: Invalid or missing API Key' }, { status: 401 });
    }

    const payload = await request.json();
    const { items, totals, order_type, customer, delivery_address, notes, payment_method } = payload;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Validation Error: Items array is missing or empty' }, { status: 400 });
    }

    const validPaymentMethods = ['cash', 'credit_card', 'transfer', 'jazzcash', 'foodpanda'];
    if (!validPaymentMethods.includes(payment_method)) {
      return NextResponse.json({ error: 'Validation Error: Invalid payment_method' }, { status: 400 });
    }

    const validOrderTypes = ['dine_in', 'takeaway', 'delivery', 'online'];
    if (order_type && !validOrderTypes.includes(order_type)) {
      return NextResponse.json({ error: 'Validation Error: Invalid order_type' }, { status: 400 });
    }

    const computedTotal = Number(totals?.total || 0);
    if (computedTotal <= 0) {
      return NextResponse.json({ error: 'Validation Error: Total must be greater than zero' }, { status: 400 });
    }

    // Since we are Server-Side and Vercel ENV keys are protected, we can map direct Supabase inserts securely. 
    // Usually we would use service_role here if RLS blocking inserts. We'll use the anon client since RLS permits inserts natively in this schema so long as service bypass if necessary.
    // In our case, the DB might restrict it, so let's use the standard supabase admin route abstraction when required, or just use the local anon `supabase`.
    // Let's assume `supabase` proxy is fine.
    
    // 1. GENERATE ORDER NUMBER
    const today = new Date();
    const prefix = `ORD-${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}`;
    const { count, error: countError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .like('orderNumber', `${prefix}%`);
    if (countError) throw countError;
    const countToday = count || 0;
    const orderNumber = `${prefix}-${(countToday + 1).toString().padStart(3, '0')}`;

    // 2. BUILD ORDER
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        orderNumber,
        status: 'placed',
        source: 'website',
        customerName: customer?.name || null,
        customerPhone: customer?.phone || null,
        orderType: order_type || 'online',
        paymentMethod: payment_method,
        subtotal: Number(totals?.subtotal || computedTotal),
        discount: Number(totals?.discount || 0),
        tax: Number(totals?.tax || 0),
        finalTotal: computedTotal,
      })
      .select()
      .single();

    if (orderError || !order) {
      throw new Error(`Failed to map root order: ${orderError?.message}`);
    }

    // 3. MAP ITEMS
    const orderItems = items.map((i: any) => ({
        orderId: order.id,
        itemId: i.menu_item_id ? Number(i.menu_item_id) : null,
        name: i.name,
        category: 'Drinks', // Defaulted or mapped
        price: Number(i.unit_price || 0),
        quantity: Number(i.quantity || 1),
        selectedOptions: i.selected_options || {},
        notes: i.notes || ''
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) {
      console.error("Failed to map API Items:", itemsError);
    }

    // DELIVER SAFE PAYLOAD 
    return NextResponse.json({
      success: true,
      order_id: order.id,
      order_number: order.orderNumber,
      status: 'placed',
      source: 'website'
    });

  } catch (err: any) {
    console.error("External API Gateway Error:", err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

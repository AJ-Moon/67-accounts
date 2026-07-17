import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { validateApiKey } from '@/lib/apiAuth';
import { getTaxConfig, computeTotals } from '@/lib/tax';
import { deductForOrder } from '@/lib/inventory';
import { buildOrderLines, generateOrderNumber, isValidPaymentMethod } from '@/lib/orders';

/**
 * POST /api/external/orders — create an order from a website or app.
 * Headers: x-api-key
 * Body: {
 *   items: [{ menu_item_id?, name, unit_price, quantity, category?, notes?, selected_options? }],
 *   payment_method, order_type?, customer?: { name?, phone? },
 *   discount_percentage?, notes?
 * }
 * Totals & tax are computed server-side — client totals are ignored.
 */
export async function POST(request: Request) {
  try {
    const auth = await validateApiKey(request);
    if (!auth.ok) return NextResponse.json({ error: 'Unauthorized: Invalid or missing API Key' }, { status: 401 });

    const payload = await request.json();
    const { items, order_type, customer, payment_method, discount_percentage } = payload;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Validation Error: Items array is missing or empty' }, { status: 400 });
    }

    const paymentMethod = payment_method || 'pending';
    if (!(await isValidPaymentMethod(paymentMethod))) {
      return NextResponse.json({ error: 'Validation Error: Invalid payment_method' }, { status: 400 });
    }

    const validOrderTypes = ['dine_in', 'takeaway', 'delivery', 'online'];
    if (order_type && !validOrderTypes.includes(order_type)) {
      return NextResponse.json({ error: 'Validation Error: Invalid order_type' }, { status: 400 });
    }

    // Resolve items against the menu when menu_item_id is given (authoritative price/category)
    const ids = items.map((i: any) => i.menu_item_id).filter(Boolean);
    let menuMap: Record<string, any> = {};
    if (ids.length > 0) {
      const { data: menuItems } = await supabase.from('items').select('*').in('id', ids);
      (menuItems || []).forEach((m: any) => { menuMap[String(m.id)] = m; });
    }

    let orderLines;
    try {
      orderLines = buildOrderLines(items.map((i: any) => {
        const m = i.menu_item_id ? menuMap[String(i.menu_item_id)] : null;
        const upsized = i.selected_options?.upsize === true;
        const basePrice = m ? Number(m.price) + (upsized ? Number(m.upsizePrice || 0) : 0) : Number(i.unit_price || 0);
        return {
          id: m?.id || null,
          name: m?.name || i.name,
          category: m?.category || i.category || 'Food',
          subcategory: m?.subcategory || i.subcategory || null,
          price: basePrice,
          quantity: Number(i.quantity || 1),
          notes: i.notes || '',
          selectedOptions: i.selected_options || null,
        };
      }));
    } catch {
      return NextResponse.json({ error: 'Validation Error: Invalid item data' }, { status: 400 });
    }

    const taxCfg = await getTaxConfig();
    const totals = computeTotals(
      { items: orderLines, discountPercentage: discount_percentage || 0, paymentMethod },
      taxCfg
    );
    if (totals.subtotal <= 0) {
      return NextResponse.json({ error: 'Validation Error: Total must be greater than zero' }, { status: 400 });
    }

    const orderNumber = await generateOrderNumber();

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        orderNumber,
        status: 'placed',
        source: 'website',
        customerName: customer?.name || null,
        customerPhone: customer?.phone || null,
        orderType: order_type || 'online',
        paymentMethod,
        subtotal: totals.subtotal,
        discount: totals.discountAmount,
        discountPercentage: totals.discountPercentage,
        discountAmount: totals.discountAmount,
        tax: totals.tax,
        taxRate: totals.taxRate,
        finalTotal: totals.finalTotal,
      })
      .select()
      .single();

    if (orderError || !order) throw new Error(`Failed to create order: ${orderError?.message}`);

    const orderItems = orderLines.map((i: any) => ({ ...i, orderId: order.id }));
    const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
    if (itemsError) console.error('Failed to insert external order items:', itemsError);

    await deductForOrder(orderItems, order.id);

    return NextResponse.json({
      success: true,
      order_id: order.id,
      order_number: order.orderNumber,
      status: 'placed',
      totals: {
        subtotal: totals.subtotal,
        discount: totals.discountAmount,
        tax: totals.tax,
        tax_rate: totals.taxRate,
        total: totals.finalTotal,
      },
    });
  } catch (err) {
    console.error('External API Gateway Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

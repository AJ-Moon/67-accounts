import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { printReceipts } from '@/lib/printer';
import { createClient } from '@/utils/supabase/server';
import { getTaxConfig, computeTotals } from '@/lib/tax';
import { deductForOrder } from '@/lib/inventory';
import { buildOrderLines, generateOrderNumber, isValidPaymentMethod } from '@/lib/orders';

export async function POST(request: Request) {
  try {
    const supabaseServer = await createClient();
    const { data: { user } } = await supabaseServer.auth.getUser();

    const json = await request.json();
    const { items, discountPercentage, paymentMethod, printReceipts: shouldPrint } = json;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 });
    }

    const resolvedPaymentMethod = paymentMethod || 'pending';
    if (!(await isValidPaymentMethod(resolvedPaymentMethod))) {
      return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 });
    }

    const orderLines = buildOrderLines(items);

    const taxCfg = await getTaxConfig();
    const totals = computeTotals(
      { items: orderLines, discountPercentage, paymentMethod: resolvedPaymentMethod },
      taxCfg
    );
    if (totals.subtotal <= 0) {
      return NextResponse.json({ error: 'Subtotal must be greater than zero' }, { status: 400 });
    }

    const orderNumber = await generateOrderNumber();

    const { data: order, error: orderError } = await supabaseServer
      .from('orders')
      .insert({
        orderNumber,
        customerName: json.customerName || null,
        customerPhone: json.customerPhone || null,
        orderType: json.orderType || null,
        subtotal: totals.subtotal,
        discount: totals.discountAmount,
        discountPercentage: totals.discountPercentage,
        discountAmount: totals.discountAmount,
        tax: totals.tax,
        taxRate: totals.taxRate,
        finalTotal: totals.finalTotal,
        paymentMethod: resolvedPaymentMethod,
        status: 'placed',
        source: 'pos',
        createdBy: user?.id || null
      })
      .select()
      .single();

    if (orderError || !order) throw new Error(`Failed to create order: ${orderError?.message}`);

    const orderItems = orderLines.map((i: any) => ({ ...i, orderId: order.id }));
    const { error: itemsError } = await supabaseServer.from('order_items').insert(orderItems);
    if (itemsError) console.error('Failed to insert order items:', itemsError);

    // Auto-deduct inventory from recipes (non-blocking on failure)
    await deductForOrder(orderItems, order.id, user?.id);

    // Ledger entry deferred until status = completed.

    let printSuccess = false;
    if (shouldPrint) {
      let { data: settings } = await supabase.from('settings').select('*').single();
      if (!settings) {
        settings = { shopName: '67', address: '', phone: '', footerMessage: 'Thank you for visiting 67', printerType: 'USB', printerAddress: '' };
      }
      try {
        printSuccess = await printReceipts({ ...order, items: orderItems } as any, settings);
      } catch (printErr) {
        console.error('Printing handled error:', printErr);
      }
    }

    return NextResponse.json({ order: { ...order, items: orderItems }, printSuccess });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`*, items:order_items(*)`)
      .order('createdAt', { ascending: false });

    if (error) throw error;
    return NextResponse.json(orders || []);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

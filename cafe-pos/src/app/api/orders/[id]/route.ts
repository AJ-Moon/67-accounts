import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createClient } from '@/utils/supabase/server';
import { getTaxConfig, computeTotals } from '@/lib/tax';
import { resyncForOrderEdit } from '@/lib/inventory';
import { buildOrderLines, isValidPaymentMethod } from '@/lib/orders';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { data, error } = await supabase
      .from('orders')
      .select('*, items:order_items(*)')
      .eq('id', id)
      .single();
    if (error || !data) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
  }
}

/**
 * Edit an order — allowed until it is completed or cancelled.
 * Body: { items?, discountPercentage?, paymentMethod?, customerName?, customerPhone?, orderType? }
 * Replaces items, recomputes totals & tax, re-syncs inventory, audit-logs the edit.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabaseServer = await createClient();
    const { data: { user } } = await supabaseServer.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const json = await request.json();

    const { data: order } = await supabase
      .from('orders')
      .select('*, items:order_items(*)')
      .eq('id', id)
      .single();
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    if (order.status === 'completed' || order.status === 'cancelled') {
      return NextResponse.json({ error: 'Order is locked — completed/cancelled orders cannot be edited.' }, { status: 400 });
    }

    const paymentMethod = json.paymentMethod ?? order.paymentMethod;
    if (!(await isValidPaymentMethod(paymentMethod))) {
      return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 });
    }

    const itemsChanged = Array.isArray(json.items);
    let newLines = itemsChanged ? buildOrderLines(json.items) : order.items;
    if (itemsChanged && newLines.length === 0) {
      return NextResponse.json({ error: 'Order must have at least one item. Cancel instead.' }, { status: 400 });
    }

    const discountPercentage = json.discountPercentage ?? order.discountPercentage ?? 0;
    const taxCfg = await getTaxConfig();
    const totals = computeTotals(
      { items: newLines, discountPercentage, paymentMethod },
      taxCfg
    );

    // Replace items if changed
    if (itemsChanged) {
      const { error: delErr } = await supabase.from('order_items').delete().eq('orderId', id);
      if (delErr) throw delErr;
      newLines = newLines.map((l: any) => ({ ...l, orderId: id }));
      const { error: insErr } = await supabase.from('order_items').insert(
        newLines.map(({ id: _lineId, createdAt: _c, updatedAt: _u, ...rest }: any) => rest)
      );
      if (insErr) throw insErr;
      await resyncForOrderEdit(newLines, id, user.id);
    }

    const { data: updated, error: updErr } = await supabase
      .from('orders')
      .update({
        customerName: json.customerName ?? order.customerName,
        customerPhone: json.customerPhone ?? order.customerPhone,
        orderType: json.orderType ?? order.orderType,
        paymentMethod,
        subtotal: totals.subtotal,
        discount: totals.discountAmount,
        discountPercentage: totals.discountPercentage,
        discountAmount: totals.discountAmount,
        tax: totals.tax,
        taxRate: totals.taxRate,
        finalTotal: totals.finalTotal,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*, items:order_items(*)')
      .single();
    if (updErr) throw updErr;

    // Audit trail
    await supabase.from('order_edits').insert({
      orderId: id,
      editedBy: user.id,
      changes: {
        before: { items: order.items?.map((i: any) => ({ name: i.name, qty: i.quantity })), finalTotal: order.finalTotal },
        after: { items: newLines.map((i: any) => ({ name: i.name, qty: i.quantity })), finalTotal: totals.finalTotal },
      },
    });

    return NextResponse.json({ success: true, order: updated });
  } catch (e) {
    console.error('Order edit error:', e);
    return NextResponse.json({ error: 'Failed to edit order' }, { status: 500 });
  }
}

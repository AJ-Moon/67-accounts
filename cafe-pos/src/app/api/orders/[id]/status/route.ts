import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createClient } from '@/utils/supabase/server';
import { getTaxConfig, computeTotals } from '@/lib/tax';
import { restoreForOrder } from '@/lib/inventory';
import { isValidPaymentMethod } from '@/lib/orders';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabaseServer = await createClient();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { new_status, paymentMethod } = await request.json();

    const validStatuses = ['placed', 'getting_ready', 'completed', 'cancelled'];
    if (!validStatuses.includes(new_status)) {
      return NextResponse.json({ error: 'Invalid status provided.' }, { status: 400 });
    }

    if (new_status === 'completed') {
      if (!paymentMethod || !(await isValidPaymentMethod(paymentMethod, false))) {
        return NextResponse.json({ error: 'Valid payment method is required to complete an order.' }, { status: 400 });
      }
    }

    const { data: order, error: fetchError } = await supabaseServer
      .from('orders')
      .select('*, items:order_items(*)')
      .eq('id', id)
      .single();
    if (fetchError || !order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });

    if (order.status === 'completed' || order.status === 'cancelled') {
      return NextResponse.json({ error: 'Order is locked and cannot be changed.' }, { status: 400 });
    }

    const updatePayload: any = { status: new_status, updatedAt: new Date().toISOString() };
    let finalTotal = Number(order.finalTotal);

    if (new_status === 'cancelled') {
      updatePayload.deletedAt = new Date().toISOString();
      updatePayload.deletedBy = user.id;
      updatePayload.deleteReason = 'Cancelled via Workflow Transition';
    }

    if (new_status === 'completed') {
      updatePayload.paymentMethod = paymentMethod;
      // Tax depends on the final payment method — recompute totals now.
      const taxCfg = await getTaxConfig();
      const totals = computeTotals(
        { items: order.items || [], discountPercentage: order.discountPercentage || 0, paymentMethod },
        taxCfg
      );
      updatePayload.subtotal = totals.subtotal;
      updatePayload.discount = totals.discountAmount;
      updatePayload.discountAmount = totals.discountAmount;
      updatePayload.tax = totals.tax;
      updatePayload.taxRate = totals.taxRate;
      updatePayload.finalTotal = totals.finalTotal;
      finalTotal = totals.finalTotal;
    }

    const { error: updateError } = await supabaseServer.from('orders').update(updatePayload).eq('id', id);
    if (updateError) throw updateError;

    // Cancelled → put recipe stock back
    if (new_status === 'cancelled') {
      await restoreForOrder(id, user.id);
    }

    // Completed → ledger entry (idempotent)
    if (new_status === 'completed') {
      const { data: existingLedger } = await supabaseServer
        .from('ledger_transactions')
        .select('id')
        .eq('orderId', id)
        .eq('transactionType', 'sale')
        .maybeSingle();

      if (!existingLedger) {
        const { error: ledgerError } = await supabaseServer.from('ledger_transactions').insert({
          transactionType: 'sale',
          destinationAccount: paymentMethod,
          paymentMethod,
          amount: finalTotal,
          orderId: order.id,
          createdBy: user.id,
        });
        if (ledgerError) console.error('Failed to record sale in ledger:', ledgerError);
      }
    }

    return NextResponse.json({ success: true, status: new_status, finalTotal });
  } catch (error) {
    console.error('Status Update Error:', error);
    return NextResponse.json({ error: 'Failed to update workflow sequence' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createClient } from '@/utils/supabase/server';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabaseServer = await createClient();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const json = await request.json();
    const { new_status, paymentMethod } = json;

    if (new_status === 'completed') {
      const validPaymentMethods = ['cash', 'credit_card', 'transfer', 'jazzcash', 'foodpanda'];
      if (!paymentMethod || !validPaymentMethods.includes(paymentMethod)) {
        return NextResponse.json({ error: 'Valid payment method is required to complete an order.' }, { status: 400 });
      }
    }

    const validStatuses = ['placed', 'getting_ready', 'completed', 'cancelled'];
    if (!validStatuses.includes(new_status)) {
       return NextResponse.json({ error: 'Invalid status provided.' }, { status: 400 });
    }

    // 1. Fetch current order
    const { data: order, error: fetchError } = await supabaseServer
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !order) {
       return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    const old_status = order.status;

    // 2. Validate transitions
    if (old_status === 'completed' || old_status === 'cancelled') {
        return NextResponse.json({ error: 'Order is locked and cannot be changed.' }, { status: 400 });
    }

    // 3. Update Order record
    const updatePayload: any = {
       status: new_status,
       updatedAt: new Date().toISOString()
    };

    if (new_status === 'cancelled') {
        updatePayload.deletedAt = new Date().toISOString();
        updatePayload.deletedBy = user.id;
        updatePayload.deleteReason = 'Cancelled via Workflow Transition';
    }

    if (new_status === 'completed') {
        updatePayload.paymentMethod = paymentMethod;
    }

    const { error: updateError } = await supabaseServer
      .from('orders')
      .update(updatePayload)
      .eq('id', id);

    if (updateError) throw updateError;

    // 4. Record Audit Trail History - SKIPPED (Not mapped in Schema setup)

    // 5. Accounting Deferment: Inject Ledger Transaction ONLY if Completed + Not Duplicate
    if (new_status === 'completed') {
        const { data: existingLedger } = await supabaseServer
           .from('ledger_transactions')
           .select('id')
           .eq('orderId', id)
           .eq('transactionType', 'sale')
           .single();

        if (!existingLedger) {
            const { error: ledgerError } = await supabaseServer
              .from('ledger_transactions')
              .insert({
                transactionType: 'sale',
                destinationAccount: paymentMethod,
                paymentMethod: paymentMethod,
                amount: order.finalTotal,
                orderId: order.id,
                createdBy: user.id
              });
              
            if (ledgerError) console.error("Failed to map Ledger execution safely:", ledgerError);
        }
    }

    return NextResponse.json({ success: true, status: new_status });

  } catch (error: any) {
    console.error("Status Update Error:", error);
    return NextResponse.json({ error: 'Failed to update workflow sequence' }, { status: 500 });
  }
}

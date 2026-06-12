import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET() {
  try {
    const supabaseServer = await createClient();
    
    // Validate Admin
    const { data: { user } } = await supabaseServer.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: profile } = await supabaseServer.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Fetch transactions joining orders to omit those that have been soft deleted
    const { data: transactions, error } = await supabaseServer
      .from('ledger_transactions')
      .select('*, orders(deletedAt)')
      .order('createdAt', { ascending: false });

    if (error) throw error;

    const history = transactions || [];

    // Valid ledger filters out completely soft-deleted sales
    const validTransactions = history.filter(t => {
      // If it's a sale, but the associated order is deleted, we exclude it from balances
      if (t.transactionType === 'sale' && t.orders && t.orders.deletedAt) {
         return false;
      }
      return true;
    });

    const balances: Record<string, number> = {
       cash: 0,
       credit_card: 0,
       transfer: 0,
       jazzcash: 0,
       foodpanda: 0,
       earnings: 0,
       cash_holding: 0
    };

    validTransactions.forEach(t => {
       // Incoming Money
       if (t.destinationAccount && balances[t.destinationAccount] !== undefined) {
          balances[t.destinationAccount] += Number(t.amount);
       }
       // Outgoing Money
       if (t.sourceAccount && balances[t.sourceAccount] !== undefined) {
          balances[t.sourceAccount] -= Number(t.amount);
       }
    });

    return NextResponse.json({ balances, history: validTransactions });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch ledger' }, { status: 500 });
  }
}

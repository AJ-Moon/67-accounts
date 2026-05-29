import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  try {
    const supabaseServer = await createClient();
    
    // Auth & Permission Checks
    const { data: { user } } = await supabaseServer.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: profile } = await supabaseServer.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const json = await request.json();
    const { sourceAccount, amount, note } = json;

    if (!sourceAccount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid transfer details' }, { status: 400 });
    }

    const { error: ledgerError } = await supabaseServer
      .from('ledger_transactions')
      .insert({
         transactionType: 'earnings_transfer',
         sourceAccount: sourceAccount,
         destinationAccount: 'earnings',
         amount: amount,
         note: note || 'Commit to Earnings',
         createdBy: user.id
      });

    if (ledgerError) throw ledgerError;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to transfer earnings' }, { status: 500 });
  }
}

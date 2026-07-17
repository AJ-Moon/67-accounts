import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createClient } from '@/utils/supabase/server';

/**
 * Capital injection / withdrawal.
 * Body: { direction: 'in'|'out', account, amount, note }
 * 'in'  → money enters `account` from Owner Capital
 * 'out' → money leaves `account` back to owner
 */
export async function POST(request: Request) {
  try {
    const supabaseServer = await createClient();
    const { data: { user } } = await supabaseServer.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { direction, account, amount, note } = await request.json();
    const amt = Number(amount);
    if (!['in', 'out'].includes(direction) || !account || !(amt > 0)) {
      return NextResponse.json({ error: 'direction (in/out), account and positive amount required' }, { status: 400 });
    }

    const { data: acc } = await supabase.from('accounts').select('code').eq('code', account).eq('isActive', true).single();
    if (!acc) return NextResponse.json({ error: 'Invalid account' }, { status: 400 });

    const { error } = await supabase.from('ledger_transactions').insert({
      transactionType: direction === 'in' ? 'capital_injection' : 'capital_withdrawal',
      sourceAccount: direction === 'in' ? 'capital' : account,
      destinationAccount: direction === 'in' ? account : 'capital',
      amount: amt,
      note: note || (direction === 'in' ? 'Capital added by owner' : 'Capital withdrawn by owner'),
      createdBy: user.id,
    });
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to record capital transaction' }, { status: 500 });
  }
}

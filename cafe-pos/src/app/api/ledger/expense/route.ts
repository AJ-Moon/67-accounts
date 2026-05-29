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
    const { title, category, amount, paidFromAccount, description, expenseDate } = json;

    if (!title || !category || !paidFromAccount || amount <= 0) {
      return NextResponse.json({ error: 'Missing required expense details' }, { status: 400 });
    }

    // Create the expense record
    const { data: expense, error: expenseError } = await supabaseServer
      .from('expenses')
      .insert({
         title,
         category,
         amount,
         paidFromAccount,
         description: description || null,
         expenseDate: expenseDate || new Date().toISOString(),
         createdBy: user.id
      })
      .select()
      .single();

    if (expenseError || !expense) throw expenseError;

    // Attach backing ledger element
    const { error: ledgerError } = await supabaseServer
      .from('ledger_transactions')
      .insert({
         transactionType: 'expense',
         sourceAccount: paidFromAccount,
         amount: amount,
         expenseId: expense.id,
         note: `EXPENSE [${category}]: ${title}`,
         createdBy: user.id
      });

    if (ledgerError) throw ledgerError;

    return NextResponse.json({ success: true, expense });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to record expense' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createClient } from '@/utils/supabase/server';

/**
 * Record a stock purchase. Adds stock (trackable items), logs the transaction,
 * and optionally creates an expense + ledger entry paid from an account.
 * Body: { ingredientId, quantity, unitCost?, paidFromAccount?, note? }
 */
export async function POST(request: Request) {
  try {
    const supabaseServer = await createClient();
    const { data: { user } } = await supabaseServer.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { ingredientId, quantity, unitCost, paidFromAccount, note } = await request.json();
    const qty = Number(quantity);
    if (!ingredientId || !(qty > 0)) {
      return NextResponse.json({ error: 'ingredientId and positive quantity required' }, { status: 400 });
    }

    const { data: ingredient } = await supabase.from('ingredients').select('*').eq('id', ingredientId).single();
    if (!ingredient) return NextResponse.json({ error: 'Ingredient not found' }, { status: 404 });

    const cost = unitCost !== undefined && unitCost !== null && unitCost !== ''
      ? Number(unitCost) : Number(ingredient.costPerUnit || 0);
    const totalCost = Number((cost * qty).toFixed(2));

    // Optional expense + ledger
    let expenseId: string | null = null;
    if (paidFromAccount && totalCost > 0) {
      const { data: accounts } = await supabase.from('accounts').select('code').eq('isActive', true);
      if (!(accounts || []).some((a: any) => a.code === paidFromAccount)) {
        return NextResponse.json({ error: 'Invalid account' }, { status: 400 });
      }
      const { data: expense, error: expErr } = await supabase.from('expenses').insert({
        category: 'Inventory',
        title: `Purchase: ${ingredient.name} (${qty} ${ingredient.unit})`,
        amount: totalCost,
        paidFromAccount,
        description: note || null,
        createdBy: user.id,
      }).select().single();
      if (expErr) throw expErr;
      expenseId = expense.id;

      await supabase.from('ledger_transactions').insert({
        transactionType: 'inventory_purchase',
        sourceAccount: paidFromAccount,
        amount: totalCost,
        expenseId,
        note: `Stock purchase: ${ingredient.name}`,
        createdBy: user.id,
      });
    }

    // Stock in (trackable only — untrackable purchases are logged but not counted)
    if (ingredient.isTrackable) {
      await supabase.rpc('adjust_stock', { p_ingredient: ingredientId, p_delta: qty });
    }
    // Update latest cost
    if (cost > 0 && cost !== Number(ingredient.costPerUnit)) {
      await supabase.from('ingredients').update({ costPerUnit: cost }).eq('id', ingredientId);
    }

    await supabase.from('inventory_transactions').insert({
      ingredientId, type: 'purchase', quantity: qty, unitCost: cost,
      expenseId, reason: note || null, createdBy: user.id,
    });

    return NextResponse.json({ success: true, totalCost });
  } catch (e) {
    console.error('Purchase error:', e);
    return NextResponse.json({ error: 'Failed to record purchase' }, { status: 500 });
  }
}

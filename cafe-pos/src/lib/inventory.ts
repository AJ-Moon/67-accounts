import { supabase } from '@/lib/supabase';

interface OrderLine {
  itemId: string | null;
  quantity: number;
  selectedOptions?: { upsize?: boolean } | null;
}

/**
 * Consumption map { ingredientId: totalQty } for a set of order lines,
 * based on recipes. Untrackable ingredients are skipped (no stock math).
 */
async function consumptionFor(lines: OrderLine[]): Promise<Record<string, number>> {
  const itemIds = [...new Set(lines.map(l => l.itemId).filter(Boolean))] as string[];
  if (itemIds.length === 0) return {};

  const { data: recipes } = await supabase
    .from('recipes')
    .select('itemId, ingredientId, quantity, upsizeExtra, ingredient:ingredients(isTrackable)')
    .in('itemId', itemIds);

  const usage: Record<string, number> = {};
  for (const line of lines) {
    if (!line.itemId) continue;
    const upsized = line.selectedOptions?.upsize === true;
    for (const r of (recipes || []).filter((r: any) => r.itemId === line.itemId)) {
      if ((r as any).ingredient?.isTrackable === false) continue;
      const perUnit = Number(r.quantity) + (upsized ? Number(r.upsizeExtra || 0) : 0);
      usage[r.ingredientId] = (usage[r.ingredientId] || 0) + perUnit * Number(line.quantity);
    }
  }
  return usage;
}

async function applyUsage(
  usage: Record<string, number>,
  direction: -1 | 1, // -1 deduct (sale), +1 restore (reversal)
  type: 'sale' | 'order_reversal',
  orderId: string,
  userId?: string | null
) {
  const entries = Object.entries(usage).filter(([, qty]) => qty > 0);
  if (entries.length === 0) return;

  for (const [ingredientId, qty] of entries) {
    await supabase.rpc('adjust_stock', { p_ingredient: ingredientId, p_delta: direction * qty });
  }
  await supabase.from('inventory_transactions').insert(
    entries.map(([ingredientId, qty]) => ({
      ingredientId,
      type,
      quantity: direction * qty,
      orderId,
      createdBy: userId || null,
    }))
  );
}

/** Deduct stock for a new order (or the added portion of an edit). */
export async function deductForOrder(lines: OrderLine[], orderId: string, userId?: string | null) {
  try {
    const usage = await consumptionFor(lines);
    await applyUsage(usage, -1, 'sale', orderId, userId);
  } catch (e) {
    console.error('Inventory deduction failed (order still saved):', e);
  }
}

/** Restore stock when an order is cancelled/deleted. */
export async function restoreForOrder(orderId: string, userId?: string | null) {
  try {
    // Sum everything previously moved for this order and reverse the net.
    const { data: txs } = await supabase
      .from('inventory_transactions')
      .select('ingredientId, quantity')
      .eq('orderId', orderId)
      .in('type', ['sale', 'order_reversal']);

    const net: Record<string, number> = {};
    (txs || []).forEach((t: any) => {
      net[t.ingredientId] = (net[t.ingredientId] || 0) + Number(t.quantity);
    });
    const usage: Record<string, number> = {};
    Object.entries(net).forEach(([id, q]) => { if (q < 0) usage[id] = -q; });
    await applyUsage(usage, 1, 'order_reversal', orderId, userId);
  } catch (e) {
    console.error('Inventory restore failed:', e);
  }
}

/**
 * Re-sync stock after an order edit: reverse the previous net consumption,
 * then deduct for the new item set. Simple and always correct.
 */
export async function resyncForOrderEdit(lines: OrderLine[], orderId: string, userId?: string | null) {
  await restoreForOrder(orderId, userId);
  await deductForOrder(lines, orderId, userId);
}

import { supabase } from '@/lib/supabase';
import { round2 } from '@/lib/tax';

export function normalizeCategory(category: string) {
  if (!category) return 'Food';
  const c = category.toString().toLowerCase();
  if (c === 'drink' || c === 'drinks') return 'Drinks';
  if (c === 'food') return 'Food';
  return category;
}

export function stationFor(category: string) {
  return normalizeCategory(category) === 'Drinks' ? 'bar' : 'kitchen';
}

export async function generateOrderNumber() {
  const today = new Date();
  const prefix = `ORD-${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}`;
  const { count } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .like('orderNumber', `${prefix}%`);
  return `${prefix}-${((count || 0) + 1).toString().padStart(3, '0')}`;
}

export function buildOrderLines(items: any[]) {
  return items.map((i: any) => {
    const price = Number(i.price || 0);
    const quantity = Number(i.quantity || 0);
    if (!i.name || price <= 0 || quantity <= 0) throw new Error('Invalid item data');

    let finalNotes = i.notes || '';
    if (i.selectedOptions && Object.keys(i.selectedOptions).length > 0) {
      finalNotes = finalNotes ? `${finalNotes} | ${JSON.stringify(i.selectedOptions)}` : JSON.stringify(i.selectedOptions);
    }
    const category = normalizeCategory(i.category);
    return {
      itemId: i.id || i.itemId || null,
      name: i.name,
      category,
      subcategory: i.subcategory || i.sub_category || null,
      price,
      quantity,
      totalPrice: round2(price * quantity),
      notes: finalNotes,
      selectedOptions: i.selectedOptions || null,
      station: stationFor(category),
      stationStatus: 'pending',
    };
  });
}

/** Validate a payment method against active accounts. 'pending' is allowed pre-completion. */
export async function isValidPaymentMethod(method: string, allowPending = true) {
  if (method === 'pending') return allowPending;
  const { data: accounts } = await supabase
    .from('accounts').select('code')
    .eq('isActive', true).eq('isPaymentMethod', true);
  return (accounts || []).some((a: any) => a.code === method);
}

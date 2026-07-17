import { supabase } from '@/lib/supabase';

export interface TotalsInput {
  items: { price: number; quantity: number; subcategory?: string | null }[];
  discountPercentage?: number;
  paymentMethod: string; // 'pending' → tax previewed at cash rate, finalized on completion
}

export async function getTaxConfig() {
  const [{ data: settings }, { data: rates }] = await Promise.all([
    supabase.from('settings').select('taxEnabled, taxInclusive').limit(1).single(),
    supabase.from('tax_rates').select('*'),
  ]);
  const rateMap: Record<string, number> = {};
  (rates || []).forEach((r: any) => { rateMap[r.paymentMethod] = Number(r.rate); });
  return {
    enabled: settings?.taxEnabled === true,
    inclusive: settings?.taxInclusive === true,
    rates: rateMap,
  };
}

export function getRateFor(paymentMethod: string, cfg: { enabled: boolean; rates: Record<string, number> }) {
  if (!cfg.enabled) return 0;
  const method = paymentMethod === 'pending' ? 'cash' : paymentMethod;
  return cfg.rates[method] ?? 0;
}

/**
 * Compute order totals. Discount (only non-combo items) is applied before tax.
 * Exclusive tax: total = (subtotal - discount) * (1 + rate).
 * Inclusive tax: prices already include tax; tax is back-calculated for reporting.
 */
export function computeTotals(input: TotalsInput, cfg: { enabled: boolean; inclusive: boolean; rates: Record<string, number> }) {
  const subtotal = round2(input.items.reduce((s, i) => s + Number(i.price) * Number(i.quantity), 0));

  // Discount policy: 0–30% max, whole numbers (UI offers steps of 5)
  const normalizedDiscount = Math.min(30, Math.max(0, Math.round(Number(input.discountPercentage || 0))));
  const discountableSubtotal = input.items.reduce((sum, i) => {
    if ((i.subcategory || '').toLowerCase() === 'combo meal') return sum;
    return sum + Number(i.price) * Number(i.quantity);
  }, 0);
  const discountAmount = round2(discountableSubtotal * normalizedDiscount / 100);

  const taxRate = getRateFor(input.paymentMethod, cfg);
  const taxable = Math.max(0, subtotal - discountAmount);

  let tax = 0;
  let finalTotal = taxable;
  if (taxRate > 0) {
    if (cfg.inclusive) {
      tax = round2(taxable - taxable / (1 + taxRate / 100));
      finalTotal = taxable;
    } else {
      tax = round2(taxable * taxRate / 100);
      finalTotal = round2(taxable + tax);
    }
  }

  return { subtotal, discountPercentage: normalizedDiscount, discountAmount, taxRate, tax, finalTotal };
}

export function round2(n: number) {
  return Number(n.toFixed(2));
}

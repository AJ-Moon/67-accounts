import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createClient } from '@/utils/supabase/server';

// Business day runs 4:00 AM → 3:59 AM next day (matches existing reports)
const BUSINESS_SHIFT_MS = 4 * 60 * 60 * 1000;

function businessDayKey(dateStr: string) {
  const d = new Date(new Date(dateStr).getTime() - BUSINESS_SHIFT_MS);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function businessMonthKey(dateStr: string) {
  return businessDayKey(dateStr).slice(0, 7);
}

function bounds(from?: string | null, to?: string | null) {
  const now = new Date();
  const start = from
    ? new Date(new Date(from).getFullYear(), new Date(from).getMonth(), new Date(from).getDate(), 4, 0, 0, 0)
    : new Date(now.getFullYear(), now.getMonth(), 1, 4, 0, 0, 0);
  const endBase = to ? new Date(to) : now;
  const end = new Date(endBase.getFullYear(), endBase.getMonth(), endBase.getDate() + 1, 3, 59, 59, 999);
  return { start, end };
}

/**
 * GET /api/reports/export?type=sales_daily|sales_monthly|sales_orders|ledger|expenses|wastage&from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns { title, columns, rows, summary } ready for PDF rendering.
 */
export async function GET(request: Request) {
  try {
    const supabaseServer = await createClient();
    const { data: { user } } = await supabaseServer.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (!profile || !['admin', 'manager'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'sales_daily';
    const { start, end } = bounds(url.searchParams.get('from'), url.searchParams.get('to'));
    const rangeLabel = `${start.toLocaleDateString()} — ${new Date(end.getTime() - 86400000).toLocaleDateString()}`;
    const fmt = (n: number) => Number(n.toFixed(2));

    if (type === 'sales_daily' || type === 'sales_monthly' || type === 'sales_orders') {
      const { data: orders } = await supabase
        .from('orders')
        .select('orderNumber, createdAt, status, paymentMethod, subtotal, discountAmount, tax, finalTotal, source')
        .eq('status', 'completed')
        .gte('createdAt', start.toISOString())
        .lte('createdAt', end.toISOString())
        .order('createdAt');
      const rows = orders || [];

      if (type === 'sales_orders') {
        return NextResponse.json({
          title: `Sales — All Orders (${rangeLabel})`,
          columns: ['Order #', 'Date', 'Payment', 'Subtotal', 'Discount', 'Tax', 'Total'],
          rows: rows.map((o: any) => [
            o.orderNumber,
            new Date(o.createdAt).toLocaleString(),
            o.paymentMethod,
            fmt(Number(o.subtotal)), fmt(Number(o.discountAmount || 0)), fmt(Number(o.tax || 0)), fmt(Number(o.finalTotal)),
          ]),
          summary: {
            'Orders': rows.length,
            'Gross Sales': fmt(rows.reduce((s: number, o: any) => s + Number(o.finalTotal), 0)),
            'Total Tax': fmt(rows.reduce((s: number, o: any) => s + Number(o.tax || 0), 0)),
            'Total Discount': fmt(rows.reduce((s: number, o: any) => s + Number(o.discountAmount || 0), 0)),
          },
        });
      }

      const keyFn = type === 'sales_daily' ? businessDayKey : businessMonthKey;
      const groups: Record<string, { count: number; subtotal: number; discount: number; tax: number; total: number }> = {};
      rows.forEach((o: any) => {
        const k = keyFn(o.createdAt);
        groups[k] = groups[k] || { count: 0, subtotal: 0, discount: 0, tax: 0, total: 0 };
        groups[k].count += 1;
        groups[k].subtotal += Number(o.subtotal);
        groups[k].discount += Number(o.discountAmount || 0);
        groups[k].tax += Number(o.tax || 0);
        groups[k].total += Number(o.finalTotal);
      });
      const keys = Object.keys(groups).sort();
      return NextResponse.json({
        title: `Sales by ${type === 'sales_daily' ? 'Day' : 'Month'} (${rangeLabel})`,
        columns: [type === 'sales_daily' ? 'Day' : 'Month', 'Orders', 'Subtotal', 'Discount', 'Tax', 'Total Sales'],
        rows: keys.map(k => [k, groups[k].count, fmt(groups[k].subtotal), fmt(groups[k].discount), fmt(groups[k].tax), fmt(groups[k].total)]),
        summary: {
          'Orders': rows.length,
          'Gross Sales': fmt(keys.reduce((s, k) => s + groups[k].total, 0)),
          'Total Tax': fmt(keys.reduce((s, k) => s + groups[k].tax, 0)),
        },
      });
    }

    if (type === 'ledger') {
      const { data } = await supabase
        .from('ledger_transactions')
        .select('createdAt, transactionType, sourceAccount, destinationAccount, amount, note')
        .gte('createdAt', start.toISOString())
        .lte('createdAt', end.toISOString())
        .order('createdAt');
      const rows = data || [];
      return NextResponse.json({
        title: `Ledger Entries (${rangeLabel})`,
        columns: ['Date', 'Type', 'From', 'To', 'Amount', 'Note'],
        rows: rows.map((t: any) => [
          new Date(t.createdAt).toLocaleString(),
          t.transactionType.replace(/_/g, ' '),
          t.sourceAccount || '—', t.destinationAccount || '—',
          fmt(Number(t.amount)), t.note || '',
        ]),
        summary: { 'Entries': rows.length, 'Total Volume': fmt(rows.reduce((s: number, t: any) => s + Number(t.amount), 0)) },
      });
    }

    if (type === 'expenses') {
      const { data } = await supabase
        .from('expenses')
        .select('createdAt, category, title, amount, paidFromAccount, description')
        .gte('createdAt', start.toISOString())
        .lte('createdAt', end.toISOString())
        .order('createdAt');
      const rows = data || [];
      return NextResponse.json({
        title: `Expenses (${rangeLabel})`,
        columns: ['Date', 'Category', 'Title', 'Paid From', 'Amount'],
        rows: rows.map((e: any) => [
          new Date(e.createdAt).toLocaleDateString(), e.category, e.title, e.paidFromAccount, fmt(Number(e.amount)),
        ]),
        summary: { 'Expenses': rows.length, 'Total Spent': fmt(rows.reduce((s: number, e: any) => s + Number(e.amount), 0)) },
      });
    }

    if (type === 'wastage') {
      const { data } = await supabase
        .from('v_wastage')
        .select('*')
        .gte('createdAt', start.toISOString())
        .lte('createdAt', end.toISOString())
        .order('createdAt');
      const rows = data || [];
      return NextResponse.json({
        title: `Wastage Report (${rangeLabel})`,
        columns: ['Date', 'Ingredient', 'Quantity', 'Reason', 'Est. Cost'],
        rows: rows.map((w: any) => [
          new Date(w.createdAt).toLocaleDateString(), w.ingredient, `${Number(w.quantity)} ${w.unit}`, w.reason || '', fmt(Number(w.estimatedCost || 0)),
        ]),
        summary: { 'Records': rows.length, 'Estimated Loss': fmt(rows.reduce((s: number, w: any) => s + Number(w.estimatedCost || 0), 0)) },
      });
    }

    return NextResponse.json({ error: 'Unknown report type' }, { status: 400 });
  } catch (e) {
    console.error('Report export error:', e);
    return NextResponse.json({ error: 'Failed to build report' }, { status: 500 });
  }
}

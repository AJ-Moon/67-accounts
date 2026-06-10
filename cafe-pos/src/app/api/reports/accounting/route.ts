import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic'; // Prevent aggressive static caching

function getDateBounds(range: string, customStart?: string, customEnd?: string) {
  const now = new Date();
  let start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (range === 'yesterday') {
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() - 1);
  } else if (range === 'week') {
    // start of week (Sunday)
    start.setDate(start.getDate() - start.getDay());
  } else if (range === 'month') {
    // start of month
    start.setDate(1);
  } else if (range === 'lastMonth') {
    start.setMonth(start.getMonth() - 1);
    start.setDate(1);
    end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  } else if (range === 'custom' && customStart && customEnd) {
    start = new Date(customStart);
    start.setHours(0, 0, 0, 0);
    end = new Date(customEnd);
    end.setHours(23, 59, 59, 999);
  }
  return { startDate: start, endDate: end };
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    
    // 1. RBAC check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (!profile || (profile.role !== 'admin' && profile.role !== 'desk')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // 2. Parse Dates
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || 'today';
    const cStart = searchParams.get('startDate') || undefined;
    const cEnd = searchParams.get('endDate') || undefined;
    const { startDate, endDate } = getDateBounds(range, cStart, cEnd);
    
    const isoStart = startDate.toISOString();
    const isoEnd = endDate.toISOString();

    // 3. Fetch Scope Data
    // We fetch global ledger for absolute balances, but filter others.
    const [ordersRes, expensesRes, globalLedgerRes] = await Promise.all([
       supabase.from('orders')
         .select('*, order_items(*)')
         .is('deletedAt', null)
         .eq('status', 'completed')
         .gte('createdAt', isoStart)
         .lte('createdAt', isoEnd),

       supabase.from('expenses')
         .select('*')
         .gte('createdAt', isoStart)
         .lte('createdAt', isoEnd)
         .order('createdAt', { ascending: false }),

       supabase.from('ledger_transactions')
         .select('*')
         .order('createdAt', { ascending: false })
    ]);

    if (ordersRes.error) throw ordersRes.error;
    if (expensesRes.error) throw expensesRes.error;
    if (globalLedgerRes.error) throw globalLedgerRes.error;

    const orders = ordersRes.data || [];
    const scopedExpenses = expensesRes.data || [];
    const globalLedger = globalLedgerRes.data || [];
    
    // Map scoped ledger (within date range) for Reports
    const scopedLedger = globalLedger.filter((t: any) => t.createdAt >= isoStart && t.createdAt <= isoEnd);

    // ============================================
    // 4. MATHEMATICS & AGGREGATIONS
    // ============================================

    // A. ALL-TIME ACCOUNT BALANCES (from global ledger)
    const accountsList = ['cash', 'credit_card', 'transfer', 'jazzcash', 'foodpanda', 'earnings'];
    const currentBalances = accountsList.reduce((acc, acct) => {
      const incoming = globalLedger.filter(t => t.destinationAccount === acct).reduce((sum, t) => sum + Number(t.amount), 0);
      const outgoing = globalLedger.filter(t => t.sourceAccount === acct).reduce((sum, t) => sum + Number(t.amount), 0);
      acc[acct] = { incoming, outgoing, current: incoming - outgoing };
      return acc;
    }, {} as Record<string, {incoming: number; outgoing: number; current: number}>);

    // B. SALES REPORT (Scoped)
    const salesReport = {
      totalSales: orders.reduce((sum, o) => sum + Number(o.finalTotal), 0),
      orderCount: orders.length,
      averageOrderValue: orders.length > 0 ? (orders.reduce((sum, o) => sum + Number(o.finalTotal), 0) / orders.length) : 0,
      byMethod: orders.reduce((acc, o) => {
        acc[o.paymentMethod] = (acc[o.paymentMethod] || 0) + Number(o.finalTotal);
        return acc;
      }, {} as Record<string, number>),
      byCategory: {} as Record<string, number>
    };

    orders.forEach(o => {
      o.order_items?.forEach((item: any) => {
        const cat = item.category || 'Uncategorized';
        salesReport.byCategory[cat] = (salesReport.byCategory[cat] || 0) + Number(item.totalPrice);
      });
    });

    // C. EXPENSES REPORT (Scoped)
    const expensesReport = {
      totalExpenses: scopedExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
      byCategory: scopedExpenses.reduce((acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
        return acc;
      }, {} as Record<string, number>),
      byAccount: scopedExpenses.reduce((acc, e) => {
        acc[e.paidFromAccount] = (acc[e.paidFromAccount] || 0) + Number(e.amount);
        return acc;
      }, {} as Record<string, number>),
      list: scopedExpenses
    };

    // D. EARNINGS / MOVEMENT REPORT (Scoped)
    const earningsReport = {
      totalMovedIn: scopedLedger.filter((t: any) => t.destinationAccount === 'earnings').reduce((sum, t) => sum + Number(t.amount), 0),
      expensesPaidFromEarnings: expensesReport.byAccount['earnings'] || 0,
      breakdownSource: scopedLedger.filter((t: any) => t.destinationAccount === 'earnings').reduce((acc, t) => {
        if (t.sourceAccount) acc[t.sourceAccount] = (acc[t.sourceAccount] || 0) + Number(t.amount);
        return acc;
      }, {} as Record<string, number>),
      history: scopedLedger.filter((t: any) => t.destinationAccount === 'earnings')
    };

    // E. SUMMARY / PROFIT (Scoped)
    const summary = {
      grossSales: salesReport.totalSales,
      totalExpenses: expensesReport.totalExpenses,
      netAmount: salesReport.totalSales - expensesReport.totalExpenses,
      totalAvailableLiquidMoney: accountsList.reduce((sum, acct) => sum + currentBalances[acct].current, 0)
    };

    return NextResponse.json({
      startDate: isoStart,
      endDate: isoEnd,
      currentBalances,
      salesReport,
      expensesReport,
      earningsReport,
      summary,
      ledger: scopedLedger
    });

  } catch (error) {
    console.error('Accounting Report Error:', error);
    return NextResponse.json({ error: 'Failed to generate accounting reports' }, { status: 500 });
  }
}

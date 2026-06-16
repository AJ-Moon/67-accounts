import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

function getRangeDates(range: string, startDate?: string, endDate?: string) {
  // Business day ends at 1:30 AM, shift by 4 hours
  const realNow = new Date();
  const businessNow = new Date(realNow.getTime() - 4 * 60 * 60 * 1000);
  
  let start = new Date(businessNow.getFullYear(), businessNow.getMonth(), businessNow.getDate(), 4, 0, 0, 0);
  let finish = new Date(businessNow.getFullYear(), businessNow.getMonth(), businessNow.getDate() + 1, 3, 59, 59, 999);

  if (range === 'custom' && startDate && endDate) {
    const sDate = new Date(startDate);
    const gte = new Date(sDate.getFullYear(), sDate.getMonth(), sDate.getDate(), 4, 0, 0, 0);
    const eDate = new Date(endDate);
    const lte = new Date(eDate.getFullYear(), eDate.getMonth(), eDate.getDate() + 1, 3, 59, 59, 999);
    return { gte, lte };
  }

  if (range === 'yesterday') {
    start.setDate(start.getDate() - 1);
    finish.setDate(finish.getDate() - 1);
    return { gte: start, lte: finish };
  }

  if (range === 'week') {
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    return { gte: start, lte: finish };
  }

  if (range === 'month') {
    start.setDate(1);
    return { gte: start, lte: finish };
  }

  if (range === 'previousMonth') {
    start.setDate(1);
    start.setMonth(start.getMonth() - 1);
    finish = new Date(start.getFullYear(), start.getMonth() + 1, 1, 3, 59, 59, 999);
    return { gte: start, lte: finish };
  }

  return { gte: start, lte: finish };
}

function normalizeCategory(category: string) {
  if (!category) return 'Food';
  const c = category.toString().toLowerCase();
  if (c === 'drink' || c === 'drinks') return 'Drinks';
  if (c === 'food') return 'Food';
  return category;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || 'today';
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const { gte, lte } = getRangeDates(range, startDate, endDate);

    let { data: settings } = await supabase.from('settings').select('*').single();
    if (!settings) {
      settings = { shopName: '67 Cafe', address: '', phone: '', footerMessage: '', printerType: 'USB', printerAddress: '' };
    }

    const { data: ordersData, error } = await supabase
      .from('orders')
      .select(`
        *,
        items:order_items(*)
      `)
      .gte('createdAt', gte.toISOString())
      .lte('createdAt', lte.toISOString())
      .order('createdAt', { ascending: false });

    if (error) throw error;
    const orders = ordersData || [];

    let totalSales = 0;
    let totalOrders = 0;
    let cashSales = 0;
    let cardSales = 0;
    let transferSales = 0;
    let foodpandaSales = 0;
    let jazzcashSales = 0;
    let discounts = 0;
    let cancelledCount = 0;
    let drinksRev = 0;
    let foodRev = 0;

    const itemDict: Record<string, { category: string; subcategory: string; qty: number; rev: number }> = {};
    const categorySales: Record<string, number> = {};
    const subcategorySales: Record<string, number> = {};

    orders.forEach((o: any) => {
      if (o.status === 'Cancelled') {
        cancelledCount++;
        return;
      }

      totalOrders++;
      totalSales += o.finalTotal;
      discounts += (o.discountAmount ?? o.discount ?? 0);

      if (o.paymentMethod === 'Cash') cashSales += o.finalTotal;
      else if (o.paymentMethod === 'Credit Card' || o.paymentMethod === 'Card') cardSales += o.finalTotal;
      else if (o.paymentMethod === 'Transfer') transferSales += o.finalTotal;
      else if (o.paymentMethod === 'Foodpanda') foodpandaSales += o.finalTotal;

      o.items.forEach((i: any) => {
        const category = normalizeCategory(i.category);
        const subcategory = i.subcategory || 'General';
        const rev = i.price * i.quantity;

        categorySales[category] = (categorySales[category] || 0) + rev;
        subcategorySales[subcategory] = (subcategorySales[subcategory] || 0) + rev;

        if (!itemDict[i.name]) itemDict[i.name] = { category, subcategory, qty: 0, rev: 0 };
        itemDict[i.name].qty += i.quantity;
        itemDict[i.name].rev += rev;

        if (category === 'Drinks') drinksRev += rev;
        if (category === 'Food') foodRev += rev;
      });
    });

    let csv = 'Business Info,\n';
    csv += `Shop Name,${settings.shopName}\n`;
    csv += `Report Type,${range.toUpperCase()}\n`;
    csv += `Date Range,${gte.toISOString().split('T')[0]} to ${lte.toISOString().split('T')[0]}\n`;
    csv += `Generated,${new Date().toISOString()}\n\n`;

    csv += 'Summary,\n';
    csv += `Total Sales,${totalSales}\n`;
    csv += `Total Orders,${totalOrders}\n`;
    csv += `Cash Sales,${cashSales}\n`;
    csv += `Credit Card Sales,${cardSales}\n`;
    csv += `Transfer Sales,${transferSales}\n`;
    csv += `Foodpanda Sales,${foodpandaSales}\n`;
    csv += `JazzCash Sales,${jazzcashSales}\n`;
    csv += `Discounts Given,${discounts}\n`;
    csv += `Cancelled Orders,${cancelledCount}\n\n`;

    csv += 'Order Breakdown,\n';
    const escapeCSV = (val: any) => {
      const str = String(val ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
         return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    const csvRows = [
      ['Order #', 'Date', 'Type', 'Status', 'Items', 'Total', 'Payment', 'Discount'],
      ...orders.map(o => {
        if (o.status === 'deleted' || o.deletedAt) return null;
        const items = o.items.map((i: any) => `${i.quantity}x ${i.name}`).join('; ');
        const date = new Date(o.createdAt).toLocaleString();
        
        let paymentFormatted = o.paymentMethod;
        if (paymentFormatted === 'credit_card') paymentFormatted = 'Credit Card';
        if (paymentFormatted === 'cash') paymentFormatted = 'Cash';
        if (paymentFormatted === 'transfer') paymentFormatted = 'Transfer';
        if (paymentFormatted === 'jazzcash') paymentFormatted = 'JazzCash';
        if (paymentFormatted === 'foodpanda') paymentFormatted = 'Foodpanda';

        return [
          o.orderNumber,
          date,
          o.orderType || 'N/A',
          o.status,
          items,
          o.finalTotal,
          paymentFormatted,
          o.discountAmount || o.discount || 0
        ].map(escapeCSV).join(',');
      }).filter(Boolean)
    ].join('\n');
    csv += csvRows;

    csv += '\n\nItem Breakdown,\n';
    csv += 'Item Name,Category,Subcategory,Quantity Sold,Revenue\n';
    Object.keys(itemDict).sort((a, b) => itemDict[b].qty - itemDict[a].qty).forEach(name => {
      const data = itemDict[name];
      csv += `"${name}",${data.category},${data.subcategory},${data.qty},${data.rev}\n`;
    });

    csv += '\nCategory Breakdown,\n';
    csv += `Drinks Revenue,${drinksRev}\n`;
    csv += `Food Revenue,${foodRev}\n`;

    csv += '\nSales by Main Category\nCategory,Revenue\n';
    Object.entries(categorySales).forEach(([category, rev]) => {
      csv += `${category},${rev}\n`;
    });

    csv += '\nSales by Subcategory\nSubcategory,Revenue\n';
    Object.entries(subcategorySales).forEach(([subcategory, rev]) => {
      csv += `${subcategory},${rev}\n`;
    });

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="report-${range}-${Date.now()}.csv"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}

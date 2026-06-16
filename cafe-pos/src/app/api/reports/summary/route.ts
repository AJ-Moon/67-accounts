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
    let cancelledCount = 0;
    let discounts = 0;
    let drinksRev = 0;
    let foodRev = 0;

    const itemDict: Record<string, { category: string; qty: number; rev: number }> = {};
    const recentOrders: any[] = [];

    orders.forEach((o: any) => {
      if (o.status === 'deleted' || o.status === 'Cancelled' || o.deletedAt) {
        cancelledCount++;
        return;
      }

      totalOrders++;
      totalSales += o.finalTotal;
      discounts += (o.discountAmount ?? o.discount ?? 0);

      if (o.paymentMethod === 'cash' || o.paymentMethod === 'Cash') cashSales += o.finalTotal;
      else if (o.paymentMethod === 'credit_card' || o.paymentMethod === 'Credit Card' || o.paymentMethod === 'Card') cardSales += o.finalTotal;
      else if (o.paymentMethod === 'transfer' || o.paymentMethod === 'Transfer') transferSales += o.finalTotal;
      else if (o.paymentMethod === 'foodpanda' || o.paymentMethod === 'Foodpanda') foodpandaSales += o.finalTotal;
      else if (o.paymentMethod === 'jazzcash' || o.paymentMethod === 'JazzCash') jazzcashSales += o.finalTotal;

      o.items.forEach((i: any) => {
        const category = normalizeCategory(i.category);
        if (category === 'Drinks') drinksRev += (i.price * i.quantity);
        if (category === 'Food') foodRev += (i.price * i.quantity);

        if (!itemDict[i.name]) itemDict[i.name] = { category, qty: 0, rev: 0 };
        itemDict[i.name].qty += i.quantity;
        itemDict[i.name].rev += (i.price * i.quantity);
      });

      if (recentOrders.length < 5) {
        recentOrders.push({
          orderNumber: o.orderNumber,
          createdAt: o.createdAt,
          status: o.status,
          paymentMethod: o.paymentMethod,
          finalTotal: o.finalTotal,
        });
      }
    });

    const bestSellers = Object.keys(itemDict)
      .map(name => ({ name, ...itemDict[name] }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);

    return NextResponse.json({
      summary: {
        totalSales,
        totalOrders,
        cashSales,
        cardSales,
        transferSales,
        jazzcashSales,
        foodpandaSales,
        cancelledCount,
        discounts,
        netSales: totalSales,
        drinksRev,
        foodRev,
        averageOrderValue: totalOrders > 0 ? totalSales / totalOrders : 0,
      },
      bestSellers,
      recentOrders,
    });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}

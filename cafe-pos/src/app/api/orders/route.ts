import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { printReceipts } from '@/lib/printer';
import { createClient } from '@/utils/supabase/server';

function normalizeCategory(category: string) {
  if (!category) return 'Food';
  const c = category.toString().toLowerCase();
  if (c === 'drink' || c === 'drinks') return 'Drinks';
  if (c === 'food') return 'Food';
  return category;
}

export async function POST(request: Request) {
  try {
    const supabaseServer = await createClient();
    const { data: { user } } = await supabaseServer.auth.getUser();

    const json = await request.json();
    const { items, subtotal, discountPercentage, paymentMethod, printReceipts: shouldPrint } = json;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 });
    }

    const validPaymentMethods = ['pending', 'cash', 'credit_card', 'transfer', 'jazzcash', 'foodpanda'];
    const resolvedPaymentMethod = paymentMethod || 'pending';
    if (!validPaymentMethods.includes(resolvedPaymentMethod)) {
      return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 });
    }

    const computedSubtotal = Number(subtotal || 0);
    if (computedSubtotal <= 0) {
      return NextResponse.json({ error: 'Subtotal must be greater than zero' }, { status: 400 });
    }

    const normalizedDiscount = discountPercentage === 20 ? 20 : 0;
    // Discount only applies to non-combo-meal items
    const discountableSubtotal = (items as any[]).reduce((sum: number, i: any) => {
      const sub = (i.subcategory || i.sub_category || '').toLowerCase();
      if (sub === 'combo meal') return sum;
      return sum + (Number(i.price || 0) * Number(i.quantity || 0));
    }, 0);
    const discountAmount = Number((discountableSubtotal * normalizedDiscount / 100).toFixed(2));
    const finalTotal = Number(Math.max(0, computedSubtotal - discountAmount).toFixed(2));

    const orderItemsToValidate = items.map((i: any) => {
      const price = Number(i.price || 0);
      const quantity = Number(i.quantity || 0);
      if (!i.name || price <= 0 || quantity <= 0) {
        throw new Error('Invalid item data');
      }

      let finalNotes = i.notes || '';
      if (i.selectedOptions) {
         finalNotes = finalNotes ? `${finalNotes} | ${JSON.stringify(i.selectedOptions)}` : JSON.stringify(i.selectedOptions);
      }

      return {
        itemId: i.id,
        name: i.name,
        category: normalizeCategory(i.category),
        subcategory: i.subcategory || i.sub_category || null,
        price,
        quantity,
        totalPrice: Number((price * quantity).toFixed(2)),
        notes: finalNotes
      };
    });

    const today = new Date();
    const prefix = `ORD-${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}`;
    
    // Get count of today's orders to generate orderNumber
    const { count, error: countError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .like('orderNumber', `${prefix}%`);
      
    if (countError) throw countError;

    const countToday = count || 0;
    const orderNumber = `${prefix}-${(countToday + 1).toString().padStart(3, '0')}`;

    // Create order
    const { data: order, error: orderError } = await supabaseServer
      .from('orders')
      .insert({
        orderNumber,
        customerName: json.customerName || null,
        customerPhone: json.customerPhone || null,
        orderType: json.orderType || null,
        subtotal: computedSubtotal,
        discount: discountAmount,
        discountPercentage: normalizedDiscount,
        discountAmount,
        finalTotal,
        paymentMethod: resolvedPaymentMethod,
        status: 'placed',
        createdBy: user?.id || null
      })
      .select()
      .single();

    if (orderError || !order) {
      throw new Error(`Failed to create order: ${orderError?.message}`);
    }

    // Attach orderId to each Item and save
    const orderItems = orderItemsToValidate.map((i: any) => ({
      ...i,
      orderId: order.id,
    }));

    const { error: itemsError } = await supabaseServer
      .from('order_items')
      .insert(orderItems);

    if (itemsError) {
       console.error("Failed to insert order items:", itemsError);
    }

    // Ledger insertion removed for Phase 5. Ledger creation is strictly deferred until status explicitly hits `completed`.

    let printSuccess = false;
    if (shouldPrint) {
      let { data: settings } = await supabase.from('settings').select('*').single();
      if (!settings) {
         settings = { id: 1, shopName: '67', address: '', phone: '', footerMessage: 'Thank you for visiting 67', printerType: 'USB', printerAddress: '' };
      }
      try {
        const fullOrder = { ...order, items: orderItems };
        printSuccess = await printReceipts(fullOrder as any, settings);
      } catch (printErr) {
        console.error("Printing handled error:", printErr);
        printSuccess = false;
      }
    }

    return NextResponse.json({ order: { ...order, items: orderItems }, printSuccess });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        *,
        items:order_items(*)
      `)
      .order('createdAt', { ascending: false });

    if (error) throw error;
    return NextResponse.json(orders || []);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: './.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testLedgerInsert() {
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*, items:order_items(*)')
    .limit(1)
    .single();

  if (orderError) {
    console.error("Order error", orderError);
    return;
  }

  const payload = {
    transactionType: 'sale',
    destinationAccount: order.paymentMethod,
    paymentMethod: order.paymentMethod,
    amount: order.finalTotal,
    orderId: order.id
  };
  
  console.log("Attempting insert payload:", payload);

  const { data, error } = await supabase
    .from('ledger_transactions')
    .insert(payload);

  if (error) {
    console.error("Ledger Insert Error:", error);
  } else {
    console.log("Success:", data);
  }
}

testLedgerInsert();

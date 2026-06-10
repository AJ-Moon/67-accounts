require('dotenv').config({ path: './.env' });

async function getLedger() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/ledger_transactions`, {
    method: 'POST',
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
       transactionType: 'sale',
       paymentMethod: 'cash',
       destinationAccount: 'cash',
       amount: 100,
       note: 'test ledger directly from Admin'
    })
  });
  console.log(await res.json());
}

getLedger();

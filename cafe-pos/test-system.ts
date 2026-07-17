/**
 * System logic tests — run with: npx tsx test-system.ts
 * Tests the tax engine, receipt builder (upsize/notes rules), and order line builder.
 */
import { computeTotals } from './src/lib/tax';
import { buildReceiptCopies } from './src/lib/printUtils';
import { buildOrderLines, stationFor } from './src/lib/orders';

let passed = 0, failed = 0;
function check(name: string, cond: boolean, extra?: any) {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}`, extra ?? ''); }
}

console.log('\n── TAX ENGINE ──');
const cfg = { enabled: true, inclusive: false, rates: { cash: 16, credit_card: 5 } };
const items = [
  { price: 500, quantity: 2 },                            // 1000
  { price: 300, quantity: 1, subcategory: 'Combo Meal' }, // 300 (not discountable)
];

const t1 = computeTotals({ items, discountPercentage: 0, paymentMethod: 'cash' }, cfg);
check('cash 16% on 1300 → tax 208, total 1508', t1.tax === 208 && t1.finalTotal === 1508, t1);

const t2 = computeTotals({ items, discountPercentage: 20, paymentMethod: 'cash' }, cfg);
// discount 20% of 1000 (combo excluded) = 200 → taxable 1100 → tax 176 → total 1276
check('20% discount skips combo → tax 176, total 1276', t2.discountAmount === 200 && t2.tax === 176 && t2.finalTotal === 1276, t2);

const t3 = computeTotals({ items, discountPercentage: 0, paymentMethod: 'credit_card' }, cfg);
check('card 5% → tax 65, total 1365', t3.tax === 65 && t3.finalTotal === 1365, t3);

const t4 = computeTotals({ items, discountPercentage: 0, paymentMethod: 'cash' }, { ...cfg, enabled: false });
check('tax disabled → tax 0, total 1300', t4.tax === 0 && t4.finalTotal === 1300, t4);

const t5 = computeTotals({ items, discountPercentage: 0, paymentMethod: 'cash' }, { ...cfg, inclusive: true });
check('inclusive mode → total stays 1300, tax back-calculated', t5.finalTotal === 1300 && Math.abs(t5.tax - 179.31) < 0.01, t5);

const t6 = computeTotals({ items, discountPercentage: 0, paymentMethod: 'pending' }, cfg);
check('pending previews at cash rate', t6.taxRate === 16, t6);

console.log('\n── ORDER LINES / STATIONS ──');
const lines = buildOrderLines([
  { id: 'a1', name: 'Latte', category: 'drinks', price: 550, quantity: 1, selectedOptions: { upsize: true } },
  { id: 'b2', name: 'Burger', category: 'Food', price: 800, quantity: 2, notes: 'no onions' },
]);
check('drinks → bar station', lines[0].station === 'bar');
check('food → kitchen station', lines[1].station === 'kitchen');
check('station status starts pending', lines.every(l => l.stationStatus === 'pending'));
check('totalPrice computed', lines[1].totalPrice === 1600);
check('options embedded in notes for legacy + column kept', !!lines[0].selectedOptions && lines[0].notes.includes('upsize'));
check('upsize:false NOT embedded when options empty', buildOrderLines([{ id: 'c', name: 'Tea', category: 'drinks', price: 100, quantity: 1, selectedOptions: {} }])[0].notes === '');

console.log('\n── RECEIPT PRINTING ──');
const order = {
  orderNumber: 'ORD-TEST-001', createdAt: new Date().toISOString(), paymentMethod: 'cash',
  subtotal: 1900, discountAmount: 0, discountPercentage: 0, tax: 304, taxRate: 16, finalTotal: 2204,
  items: [
    { name: 'Latte', category: 'Drinks', price: 550, quantity: 1, notes: '{"upsize":true}', selectedOptions: null },
    { name: 'Green Tea', category: 'Drinks', price: 300, quantity: 1, notes: '{"upsize":false}', selectedOptions: null },
    { name: 'Burger', category: 'Food', price: 800, quantity: 2, notes: 'no onions | {"upsize":false,"option":"Spicy"}', selectedOptions: null },
  ],
};
const copies = buildReceiptCopies(order, { shopName: 'Test Cafe' });
const byType = Object.fromEntries(copies.map((c: any) => [c.type, c.content]));

check('4 copies produced (customer/shop/bar/kitchen)', copies.length === 4, copies.map((c: any) => c.type));
check('bar copy shows UPSIZE for upsized latte', byType.bar.includes('UPSIZE'));
check('upsize:false produces NO upsize line for green tea', (byType.bar.match(/UPSIZE/g) || []).length === 1, byType.bar);
check('no raw JSON printed anywhere', !copies.some((c: any) => c.content.includes('{"upsize"')), byType.kitchen);
check('kitchen copy shows clean note', byType.kitchen.includes('Note: no onions'));
check('kitchen copy shows option Spicy', byType.kitchen.includes('+ Spicy'));
check('customer copy shows tax line', byType.customer.includes('Tax (16%)'));
check('customer copy shows total 2204', byType.customer.includes('2204.00'));
check('reprint = customer copy only', buildReceiptCopies(order, { shopName: 'T' }, true).length === 1);

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);

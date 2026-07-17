# V3 Upgrade — Setup Steps

Your POS has been upgraded with inventory/recipes, wastage, tax, KDS screens,
dynamic accounts, capital, user roles, order editing, and an external API.

## 1. Run the database migration (required)

Open **Supabase → SQL Editor**, paste the contents of
`supabase-migration-v3-full-system.sql`, and run it once.
It is additive — your existing orders/ledger data is kept.
(Existing roles are remapped: `desk` → `cashier`, `staff` → `kitchen`.)

## 2. Add the service role key (required for the Users page)

In `.env`, add (from Supabase Dashboard → Settings → API):

```
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Without it everything else works, but creating users / resetting passwords won't.

## 3. Install new dependencies & restart

```
npm install        # adds jspdf for PDF reports
npm run dev        # or your start-pos.command
```

## What's new & where

| Feature | Where |
|---|---|
| Inventory, purchases, wastage, recipes | Sidebar → Inventory |
| Kitchen screen | `/kds/kitchen` (fullscreen, auto-refresh 5s) |
| Bar screen | `/kds/bar` |
| Tax (per payment method) | Settings → Tax & Billing |
| API keys for website/apps | Settings → API Keys (docs in `API.md`) |
| Capital in/out + new accounts | Accounts page → Capital / + Account |
| Users & roles | Sidebar → Users (admin only) |
| Edit order until completed | Orders page → pencil icon |
| PDF reports (sales by day/month, all orders, ledger, expenses, wastage) | Reports page → "Download PDF" (use Custom range to pick dates) |

## How things behave

- **Recipes drive stock**: when a bill is created, each item's recipe deducts
  trackable ingredients. Untrackable items (sauces etc.) show as "Untracked stock"
  and never block sales. Cancelling an order puts stock back; editing re-syncs it.
- **Tax** is previewed at the cash rate for `pending` orders and finalized with
  the payment method chosen at completion.
- **Roles**: admin = everything; manager = no Accounts/Users/Settings;
  cashier = billing + orders + KDS; kitchen = KDS screens only (auto-redirected).
- **Printing**: kitchen/bar copies now show UPSIZE only when true, and notes are
  printed clean (no JSON blobs).

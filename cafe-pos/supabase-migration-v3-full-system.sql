-- ============================================================
-- CAFE POS V3 — FULL SYSTEM MIGRATION
-- Inventory, Recipes, Wastage, Accounts, Capital, Roles,
-- KDS stations, Tax-by-payment-method, API keys, Order editing
-- Run in Supabase SQL Editor. Safe to run once on top of v2.
-- ============================================================

-- ─── 1. ROLES ───────────────────────────────────────────────
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
UPDATE public.profiles SET role = 'cashier' WHERE role = 'desk';
UPDATE public.profiles SET role = 'kitchen' WHERE role IN ('staff', 'outside');
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'manager', 'cashier', 'kitchen'));

-- ─── 2. DYNAMIC ACCOUNTS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,              -- machine name used in ledger
  name TEXT NOT NULL,                     -- display name
  type TEXT NOT NULL DEFAULT 'cash' CHECK (type IN ('cash','bank','wallet','platform','equity','other')),
  "isPaymentMethod" BOOLEAN DEFAULT TRUE, -- selectable at billing?
  "isActive" BOOLEAN DEFAULT TRUE,
  "openingBalance" NUMERIC DEFAULT 0,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.accounts (code, name, type, "isPaymentMethod") VALUES
  ('cash',         'Cash',          'cash',     TRUE),
  ('credit_card',  'Credit Card',   'bank',     TRUE),
  ('transfer',     'Bank Transfer', 'bank',     TRUE),
  ('jazzcash',     'JazzCash',      'wallet',   TRUE),
  ('foodpanda',    'Foodpanda',     'platform', TRUE),
  ('earnings',     'Earnings',      'other',    FALSE),
  ('cash_holding', 'Cash Holding',  'cash',     FALSE),
  ('capital',      'Owner Capital', 'equity',   FALSE)
ON CONFLICT (code) DO NOTHING;

-- Loosen hardcoded account CHECKs; app validates against accounts table.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT conrelid::regclass::text AS tbl, conname FROM pg_constraint
    WHERE contype = 'c' AND conrelid IN (
      'public.ledger_transactions'::regclass, 'public.expenses'::regclass, 'public.orders'::regclass
    ) AND (
      pg_get_constraintdef(oid) ILIKE '%sourceAccount%' OR
      pg_get_constraintdef(oid) ILIKE '%destinationAccount%' OR
      pg_get_constraintdef(oid) ILIKE '%paidFromAccount%' OR
      pg_get_constraintdef(oid) ILIKE '%paymentMethod%' OR
      pg_get_constraintdef(oid) ILIKE '%transactionType%'
    )
  ) LOOP
    EXECUTE 'ALTER TABLE ' || r.tbl || ' DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;
END $$;

ALTER TABLE public.ledger_transactions ADD CONSTRAINT ledger_transactions_type_check CHECK (
  "transactionType" IN ('sale','earnings_transfer','expense','manual_adjustment',
                        'interaccount_transfer','capital_injection','capital_withdrawal','inventory_purchase')
);

-- ─── 3. TAX ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tax_rates (
  "paymentMethod" TEXT PRIMARY KEY,
  rate NUMERIC NOT NULL DEFAULT 0 CHECK (rate >= 0 AND rate <= 100),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO public.tax_rates ("paymentMethod", rate) VALUES
  ('cash', 16), ('credit_card', 5), ('transfer', 5), ('jazzcash', 5), ('foodpanda', 16)
ON CONFLICT ("paymentMethod") DO NOTHING;

ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS "taxEnabled" BOOLEAN DEFAULT FALSE;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS "taxInclusive" BOOLEAN DEFAULT FALSE; -- prices include tax?
ALTER TABLE public.orders   ADD COLUMN IF NOT EXISTS "taxRate" NUMERIC DEFAULT 0;
ALTER TABLE public.orders   ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'pos'; -- pos | website | app

-- ─── 4. INVENTORY ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  unit TEXT NOT NULL DEFAULT 'pcs',            -- g, kg, ml, l, pcs, shot...
  "isTrackable" BOOLEAN DEFAULT TRUE,          -- FALSE = sauces etc: shown as "untracked stock"
  "currentStock" NUMERIC DEFAULT 0,
  "lowStockThreshold" NUMERIC DEFAULT 0,
  "costPerUnit" NUMERIC DEFAULT 0,
  "isActive" BOOLEAN DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "itemId" UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  "ingredientId" UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),   -- per 1 unit sold
  "upsizeExtra" NUMERIC DEFAULT 0,                  -- extra consumed when upsized
  UNIQUE ("itemId", "ingredientId")
);

CREATE TABLE IF NOT EXISTS public.inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "ingredientId" UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('purchase','sale','wastage','adjustment','order_reversal')),
  quantity NUMERIC NOT NULL,          -- positive = stock in, negative = stock out
  "unitCost" NUMERIC,
  "orderId" UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  "expenseId" UUID REFERENCES public.expenses(id) ON DELETE SET NULL,
  reason TEXT,                        -- wastage reason / adjustment note
  "createdBy" UUID REFERENCES auth.users(id),
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invtx_ingredient ON public.inventory_transactions ("ingredientId");
CREATE INDEX IF NOT EXISTS idx_invtx_order ON public.inventory_transactions ("orderId");

-- Atomic stock adjust helper (prevents race conditions)
CREATE OR REPLACE FUNCTION public.adjust_stock(p_ingredient UUID, p_delta NUMERIC)
RETURNS VOID LANGUAGE sql AS $$
  UPDATE public.ingredients
  SET "currentStock" = "currentStock" + p_delta, "updatedAt" = NOW()
  WHERE id = p_ingredient AND "isTrackable" = TRUE;
$$;

-- ─── 5. KDS / STATIONS ──────────────────────────────────────
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS station TEXT DEFAULT 'kitchen'; -- kitchen | bar
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS "stationStatus" TEXT DEFAULT 'pending'; -- pending | ready
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS "selectedOptions" JSONB;

-- Backfill station from category
UPDATE public.order_items SET station = 'bar' WHERE LOWER(COALESCE(category,'')) IN ('drink','drinks');

-- ─── 6. ORDER EDIT AUDIT ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId" UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  "editedBy" UUID REFERENCES auth.users(id),
  changes JSONB,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 7. API KEYS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                 -- "Website", "Mobile App"
  key TEXT NOT NULL UNIQUE,
  "isActive" BOOLEAN DEFAULT TRUE,
  "lastUsedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 8. WASTAGE VIEW (reporting convenience) ────────────────
CREATE OR REPLACE VIEW public.v_wastage AS
  SELECT t.id, t."createdAt", i.name AS ingredient, i.unit,
         ABS(t.quantity) AS quantity, t.reason,
         ABS(t.quantity) * COALESCE(t."unitCost", i."costPerUnit") AS "estimatedCost"
  FROM public.inventory_transactions t
  JOIN public.ingredients i ON i.id = t."ingredientId"
  WHERE t.type = 'wastage';

-- Also allow orders to reference any account code as payment method
ALTER TABLE public.orders ADD CONSTRAINT orders_paymentMethod_check CHECK ("paymentMethod" IS NOT NULL);

-- ─── 9. ACCOUNT BALANCES VIEW ───────────────────────────────
CREATE OR REPLACE VIEW public.v_account_balances AS
SELECT a.code, a.name, a.type, a."isActive",
  a."openingBalance"
  + COALESCE((SELECT SUM(amount) FROM public.ledger_transactions lt WHERE lt."destinationAccount" = a.code), 0)
  - COALESCE((SELECT SUM(amount) FROM public.ledger_transactions lt WHERE lt."sourceAccount" = a.code), 0)
  AS balance
FROM public.accounts a;

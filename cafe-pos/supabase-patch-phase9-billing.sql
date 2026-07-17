-- supabase-patch-phase9-billing.sql
-- Run this in Supabase SQL Editor.
-- This version uses dynamic PL/pgSQL to safely drop auto-named constraints.

DO $$ 
DECLARE
  r RECORD;
BEGIN
  -- Drop check constraints on orders
  FOR r IN (
    SELECT conname 
    FROM pg_constraint 
    WHERE conrelid = 'public.orders'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%paymentMethod%'
  ) LOOP
    EXECUTE 'ALTER TABLE public.orders DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;

  -- Drop check constraints on expenses
  FOR r IN (
    SELECT conname 
    FROM pg_constraint 
    WHERE conrelid = 'public.expenses'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%paidFromAccount%'
  ) LOOP
    EXECUTE 'ALTER TABLE public.expenses DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;

  -- Drop check constraints on ledger_transactions
  FOR r IN (
    SELECT conname 
    FROM pg_constraint 
    WHERE conrelid = 'public.ledger_transactions'::regclass AND contype = 'c' 
      AND (pg_get_constraintdef(oid) ILIKE '%sourceAccount%' 
        OR pg_get_constraintdef(oid) ILIKE '%destinationAccount%'
        OR pg_get_constraintdef(oid) ILIKE '%paymentMethod%'
        OR pg_get_constraintdef(oid) ILIKE '%transactionType%')
  ) LOOP
    EXECUTE 'ALTER TABLE public.ledger_transactions DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;
END $$;

-- Now add the new, updated constraints explicitly named so they are easy to replace in future
ALTER TABLE public.orders ADD CONSTRAINT orders_paymentMethod_check CHECK (
  "paymentMethod" IN ('pending', 'cash', 'credit_card', 'transfer', 'jazzcash', 'foodpanda')
);

ALTER TABLE public.expenses ADD CONSTRAINT expenses_paidFromAccount_check CHECK (
  "paidFromAccount" IN ('cash', 'credit_card', 'transfer', 'jazzcash', 'foodpanda', 'earnings', 'cash_holding')
);

ALTER TABLE public.ledger_transactions ADD CONSTRAINT ledger_transactions_sourceAccount_check CHECK (
  "sourceAccount" IN ('cash', 'credit_card', 'transfer', 'jazzcash', 'foodpanda', 'earnings', 'cash_holding')
);

ALTER TABLE public.ledger_transactions ADD CONSTRAINT ledger_transactions_destAccount_check CHECK (
  "destinationAccount" IN ('cash', 'credit_card', 'transfer', 'jazzcash', 'foodpanda', 'earnings', 'cash_holding')
);

ALTER TABLE public.ledger_transactions ADD CONSTRAINT ledger_transactions_paymentMethod_check CHECK (
  "paymentMethod" IN ('cash', 'credit_card', 'transfer', 'jazzcash', 'foodpanda', 'cash_holding', 'pending')
);

ALTER TABLE public.ledger_transactions ADD CONSTRAINT ledger_transactions_transactionType_check CHECK (
  "transactionType" IN ('sale', 'earnings_transfer', 'expense', 'manual_adjustment', 'interaccount_transfer')
);

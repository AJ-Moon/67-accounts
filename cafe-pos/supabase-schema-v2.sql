-- CAFÉ POS V2 SCHEMA (Complete Re-Initialization)
-- Run this block in your Supabase SQL Editor.
-- NOTE: This will DROP existing test tables to align perfectly with the UUID and Auth structure you requested.

DROP TABLE IF EXISTS public.ledger_transactions CASCADE;
DROP TABLE IF EXISTS public.expenses CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.order_items CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.items CASCADE;
DROP TABLE IF EXISTS public.settings CASCADE;

-- 1. PROFILES TABLE (RBAC)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'desk', 'outside')),
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. SETTINGS TABLE
CREATE TABLE public.settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "shopName" TEXT NOT NULL DEFAULT '67 Cafe',
    address TEXT,
    phone TEXT,
    "footerMessage" TEXT,
    "printerType" TEXT DEFAULT 'USB',
    "printerAddress" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. MENU ITEMS TABLE
CREATE TABLE public.items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  subcategory TEXT,
  size TEXT,
  variant TEXT,
  price NUMERIC NOT NULL,
  "isAvailable" BOOLEAN DEFAULT TRUE,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. ORDERS TABLE
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderNumber" TEXT NOT NULL UNIQUE,
  "customerName" TEXT,
  "customerPhone" TEXT,
  "orderType" TEXT,
  "paymentMethod" TEXT NOT NULL CHECK (
    "paymentMethod" IN ('cash', 'credit_card', 'transfer', 'jazzcash', 'foodpanda')
  ),
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax NUMERIC NOT NULL DEFAULT 0,
  discount NUMERIC NOT NULL DEFAULT 0,
  "discountPercentage" NUMERIC,
  "discountAmount" NUMERIC,
  "finalTotal" NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'posted',
  "createdBy" UUID REFERENCES auth.users(id),
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "deletedAt" TIMESTAMP WITH TIME ZONE,
  "deletedBy" UUID REFERENCES auth.users(id),
  "deleteReason" TEXT
);

-- 5. ORDER ITEMS TABLE
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId" UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  "itemId" UUID REFERENCES public.items(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  category TEXT,
  subcategory TEXT,
  size TEXT,
  variant TEXT,
  quantity NUMERIC NOT NULL,
  price NUMERIC NOT NULL,
  "totalPrice" NUMERIC NOT NULL,
  notes TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. EXPENSES TABLE
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  "paidFromAccount" TEXT NOT NULL CHECK (
    "paidFromAccount" IN ('cash', 'credit_card', 'transfer', 'jazzcash', 'foodpanda', 'earnings')
  ),
  description TEXT,
  "expenseDate" DATE DEFAULT CURRENT_DATE,
  "createdBy" UUID REFERENCES auth.users(id),
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. LEDGER TRANSACTIONS TABLE
CREATE TABLE public.ledger_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "transactionType" TEXT NOT NULL CHECK (
    "transactionType" IN ('sale', 'earnings_transfer', 'expense', 'manual_adjustment')
  ),
  "sourceAccount" TEXT CHECK (
    "sourceAccount" IN ('cash', 'credit_card', 'transfer', 'jazzcash', 'foodpanda', 'earnings')
  ),
  "destinationAccount" TEXT CHECK (
    "destinationAccount" IN ('cash', 'credit_card', 'transfer', 'jazzcash', 'foodpanda', 'earnings')
  ),
  "paymentMethod" TEXT CHECK (
    "paymentMethod" IN ('cash', 'credit_card', 'transfer', 'jazzcash', 'foodpanda')
  ),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  "orderId" UUID REFERENCES public.orders(id),
  "expenseId" UUID REFERENCES public.expenses(id),
  note TEXT,
  "createdBy" UUID REFERENCES auth.users(id),
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS (Row Level Security) Stub
-- We keep Tables open for the API initially, then enforce logic through the NextJS app boundaries.
-- However, profiles can be readable.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Profiles Read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users Update Own Profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

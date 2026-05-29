-- By default, enabling RLS without policies blocks all operations.
-- If you want RLS enabled, you must allow the POS system (which may operate anonymously) to perform Operations.

-- Enable RLS just in case it isn't fully initialized
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Drop them in case they exist to avoid duplication errors
DROP POLICY IF EXISTS "Allow POS Insert Orders" ON public.orders;
DROP POLICY IF EXISTS "Allow POS Insert Order Items" ON public.order_items;
DROP POLICY IF EXISTS "Allow POS Select Orders" ON public.orders;
DROP POLICY IF EXISTS "Allow POS Select Order Items" ON public.order_items;
DROP POLICY IF EXISTS "Allow POS Update Orders" ON public.orders;

-- Allow all READ operations globally
CREATE POLICY "Allow POS Select Orders" ON public.orders FOR SELECT TO public USING (true);
CREATE POLICY "Allow POS Select Order Items" ON public.order_items FOR SELECT TO public USING (true);

-- Allow all INSERT operations globally (so the Next.js Checkout works without a forced Login)
CREATE POLICY "Allow POS Insert Orders" ON public.orders FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow POS Insert Order Items" ON public.order_items FOR INSERT TO public WITH CHECK (true);

-- Allow all UPDATE operations globally (so Order Status changes work)
CREATE POLICY "Allow POS Update Orders" ON public.orders FOR UPDATE TO public USING (true) WITH CHECK (true);

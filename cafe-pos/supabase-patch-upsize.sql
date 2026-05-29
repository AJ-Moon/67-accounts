-- 1. ADD COLUMNS FOR UPSIZE FEATURE
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS "allowUpsize" BOOLEAN DEFAULT FALSE;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS "upsizePrice" NUMERIC DEFAULT 0;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS "selectedOptions" JSONB DEFAULT '{}'::jsonb;


-- 2. SEED THE ESPRESSO CATEGORY DRINKS
INSERT INTO public.items (name, category, subcategory, price, "allowUpsize", "upsizePrice", "isAvailable") VALUES
  ('Espresso Double Shot', 'Drinks', 'Espresso', 300, FALSE, 0, TRUE),
  ('Americano Hot', 'Drinks', 'Espresso', 450, TRUE, 200, TRUE),
  ('Americano Iced', 'Drinks', 'Espresso', 450, TRUE, 200, TRUE),
  ('Cortado', 'Drinks', 'Espresso', 500, TRUE, 200, TRUE),
  ('Latte Hot', 'Drinks', 'Espresso', 550, TRUE, 200, TRUE),
  ('Latte Iced', 'Drinks', 'Espresso', 550, TRUE, 200, TRUE),
  ('Flat White', 'Drinks', 'Espresso', 550, TRUE, 200, TRUE),
  ('Cappuccino', 'Drinks', 'Espresso', 550, TRUE, 200, TRUE);

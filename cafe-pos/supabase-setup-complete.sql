-- =============================================
-- STEP 1: RUN SCHEMA (supabase-schema-v2.sql)
-- =============================================
-- Already exists in project. Run that file first in SQL Editor.
-- It creates: profiles, settings, items, orders, order_items, expenses, ledger_transactions

-- =============================================
-- STEP 2: CREATE 3 AUTH USERS + PROFILES
-- Run this AFTER the schema above.
-- =============================================

DO $$
DECLARE
  admin_id  uuid := gen_random_uuid();
  desk_id   uuid := gen_random_uuid();
  staff_id  uuid := gen_random_uuid();
BEGIN

  -- AUTH USERS
  INSERT INTO auth.users (
    instance_id, id, aud, role,
    email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES
  (
    '00000000-0000-0000-0000-000000000000', admin_id,
    'authenticated', 'authenticated',
    'admin@67.com', crypt('Admin@6767', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000', desk_id,
    'authenticated', 'authenticated',
    'desk@67.com', crypt('Desk@6767', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000', staff_id,
    'authenticated', 'authenticated',
    'staff@67.com', crypt('Staff@6767', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now()
  );

  -- AUTH IDENTITIES (required for login to work)
  INSERT INTO auth.identities (
    provider_id, user_id, identity_data,
    provider, last_sign_in_at, created_at, updated_at
  ) VALUES
  (
    'admin@67.com', admin_id,
    json_build_object('sub', admin_id::text, 'email', 'admin@67.com'),
    'email', now(), now(), now()
  ),
  (
    'desk@67.com', desk_id,
    json_build_object('sub', desk_id::text, 'email', 'desk@67.com'),
    'email', now(), now(), now()
  ),
  (
    'staff@67.com', staff_id,
    json_build_object('sub', staff_id::text, 'email', 'staff@67.com'),
    'email', now(), now(), now()
  );

  -- PROFILES (RBAC roles)
  INSERT INTO public.profiles (id, role, display_name) VALUES
  (admin_id, 'admin', 'Admin'),
  (desk_id,  'desk',  'Desk'),
  (staff_id, 'staff', 'Staff');

END;
$$;

-- =============================================
-- STEP 3: SEED MENU ITEMS
-- Run this AFTER Step 2.
-- =============================================

-- Clear existing items first (optional)
-- DELETE FROM public.items;

-- DRINKS
INSERT INTO public.items (name, category, subcategory, price, "isAvailable") VALUES
-- Espresso
('Espresso Double Shot', 'Drinks', 'Espresso', 300, true),
('Americano', 'Drinks', 'Espresso', 450, true),
('Iced Americano', 'Drinks', 'Espresso', 450, true),
('Latte', 'Drinks', 'Espresso', 550, true),
('Iced Latte', 'Drinks', 'Espresso', 550, true),
('Cappuccino', 'Drinks', 'Espresso', 550, true),

-- Signature Coffees
('Mocha', 'Drinks', 'Signature Coffees', 650, true),
('Spanish Latte', 'Drinks', 'Signature Coffees', 650, true),
('Caramel', 'Drinks', 'Signature Coffees', 650, true),
('Vanilla', 'Drinks', 'Signature Coffees', 650, true),
('Hazelnut', 'Drinks', 'Signature Coffees', 650, true),
('Pistachio', 'Drinks', 'Signature Coffees', 750, true),
('Tiramisu', 'Drinks', 'Signature Coffees', 650, true),
('Popcorn Caramel', 'Drinks', 'Signature Coffees', 650, true),
-- Signature Coffees
('Iced Mocha', 'Drinks', 'Signature Coffees', 650, true),
('Iced Spanish Latte', 'Drinks', 'Signature Coffees', 650, true),
('Iced Caramel', 'Drinks', 'Signature Coffees', 650, true),
('Iced Vanilla', 'Drinks', 'Signature Coffees', 650, true),
('Iced Hazelnut', 'Drinks', 'Signature Coffees', 650, true),
('Iced Pistachio', 'Drinks', 'Signature Coffees', 750, true),
('Iced Tiramisu', 'Drinks', 'Signature Coffees', 650, true),
('Iced Popcorn Caramel', 'Drinks', 'Signature Coffees', 650, true),
-- Frappes
('Mocha Frappe', 'Drinks', 'Frappes', 800, true),
('Caramel Frappe', 'Drinks', 'Frappes', 800, true),
('Vanilla Frappe', 'Drinks', 'Frappes', 800, true),
('Hazelnut Frappe', 'Drinks', 'Frappes', 800, true),
('Pistachio Frappe', 'Drinks', 'Frappes', 900, true),
-- Iced Tea
('Peach Iced Tea', 'Drinks', 'Iced Tea', 400, true),
('Passion Fruit Iced Tea', 'Drinks', 'Iced Tea', 400, true),
('Strawberry Iced Tea', 'Drinks', 'Iced Tea', 400, true),
-- Signature Drinks
('Peach Breeze', 'Drinks', 'Signature Drinks', 550, true),
('Strawberry Rush', 'Drinks', 'Signature Drinks', 550, true),
('Mango Burst', 'Drinks', 'Signature Drinks', 550, true),
('Berry Cola', 'Drinks', 'Signature Drinks', 550, true),
-- Smoothies
('Blackberry Smoothie', 'Drinks', 'Smoothies', 700, true),
('Strawberry Smoothie', 'Drinks', 'Smoothies', 700, true),
('Mango Smoothie', 'Drinks', 'Smoothies', 700, true),
-- Add-ons
('Extra Shot', 'Drinks', 'Add-ons', 150, true),
('Vanilla Syrup', 'Drinks', 'Add-ons', 100, true),
('Caramel Syrup', 'Drinks', 'Add-ons', 100, true),
('Hazelnut Syrup', 'Drinks', 'Add-ons', 100, true);
('Water ', 'Drinks', 'Add-ons', 100, true);
-- FOOD
INSERT INTO public.items (name, category, subcategory, price, "isAvailable") VALUES
-- Burgers
('The BIG 67 Burger', 'Food', 'Burger', 700, true),
-- Wraps
('Mighty Wrap', 'Food', 'Wrap', 700, true),
-- Chicken Bites
('Chicken Strips', 'Food', 'Chicken Bites', 700, true),
-- Cheese Treats
('Loaded Fries', 'Food', 'Cheese Treats', 600, true),
('Cheese Balls', 'Food', 'Cheese Treats', 500, true),
-- Fries
('Plain Fries', 'Food', 'Fries', 300, true),
('Masala Fries', 'Food', 'Fries', 300, true),
('Saucy Fries', 'Food', 'Fries', 350, true),
('Curly Fries', 'Food', 'Fries', 400, true),
-- Combo Meals
('Burger Combo Meal', 'Food', 'Combo Meal', 1250, true),
('Wrap Combo Meal', 'Food', 'Combo Meal', 1250, true),
-- Add-ons
('Extra Sauce Dip', 'Food', 'Add-ons', 67, true);
('Extra Cheese', 'Food', 'Add-ons', 67, true);
('Cheese Slice', 'Food', 'Add-ons', 67, true);


INSERT INTO public.items (name, category, subcategory, price, "isAvailable") VALUES
('Choclatey Mini Pancakes', 'Desserts', 'Mini Pancakes', 500, true);
('Kitkat Mini Pancakes', 'Desserts', 'Mini Pancakes', 650, true);
('Oreo Mini Pancakes', 'Desserts', 'Mini Pancakes', 550, true);
('Choclatey Waffles', 'Desserts', 'Waffles', 500, true);
('Kitkat Waffles', 'Desserts', 'Waffles', 650, true);
('Oreo Waffles', 'Desserts', 'Waffles', 550, true);
('Ice Cream Scoop', 'Desserts', 'Add-ons', 100, true);
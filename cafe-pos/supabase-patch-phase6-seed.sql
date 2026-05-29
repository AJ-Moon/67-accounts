-- Delete existing items to avoid duplicates if you wish (Optional)
-- DELETE FROM public.items;

-- Insert Drinks
INSERT INTO public.items (name, category, subcategory, price, "isAvailable", "allowUpsize", "upsizePrice") VALUES
-- Espresso
('Espresso Double Shot', 'Drinks', 'Espresso', 350, true, false, 0),
('Americano', 'Drinks', 'Espresso', 450, true, true, 200),
('Latte', 'Drinks', 'Espresso', 500, true, true, 200),
('Cappuccino', 'Drinks', 'Espresso', 500, true, true, 200),
('Flat White', 'Drinks', 'Espresso', 500, true, true, 200),
('Cortado', 'Drinks', 'Espresso', 450, true, true, 200),
('Mocha', 'Drinks', 'Espresso', 550, true, true, 200),
('Spanish Latte', 'Drinks', 'Espresso', 550, true, true, 200),
('Vietnamese Coffee', 'Drinks', 'Espresso', 550, true, true, 200),

-- Signature Coffees (Upsize +250)
('Caramel Macchiato', 'Drinks', 'Signature Coffees', 600, true, true, 250),
('White Mocha', 'Drinks', 'Signature Coffees', 600, true, true, 250),
('Honey Almond Latte', 'Drinks', 'Signature Coffees', 650, true, true, 250),
('Salted Caramel Latte', 'Drinks', 'Signature Coffees', 600, true, true, 250),

-- Frappes (Upsize +300)
('Mocha Frappe', 'Drinks', 'Frappes', 650, true, true, 300),
('Caramel Frappe', 'Drinks', 'Frappes', 650, true, true, 300),
('Vanilla Frappe', 'Drinks', 'Frappes', 600, true, true, 300),
('Chocolate Frappe', 'Drinks', 'Frappes', 600, true, true, 300),

-- Iced Tea
('Peach Iced Tea', 'Drinks', 'Iced Tea', 400, true, true, 150),
('Lemon Iced Tea', 'Drinks', 'Iced Tea', 400, true, true, 150),

-- Signature Drinks
('Mint Lemonade', 'Drinks', 'Signature Drinks', 400, true, true, 150),
('Strawberry Lemonade', 'Drinks', 'Signature Drinks', 450, true, true, 200),

-- Smoothies
('Mango Smoothie', 'Drinks', 'Smoothies', 550, true, true, 200),
('Strawberry Banana', 'Drinks', 'Smoothies', 600, true, true, 200),

-- Add-ons (Drinks)
('Extra Shot', 'Drinks', 'Add-ons', 150, true, false, 0),
('Vanilla Syrup', 'Drinks', 'Add-ons', 100, true, false, 0),
('Caramel Syrup', 'Drinks', 'Add-ons', 100, true, false, 0),
('Hazelnut Syrup', 'Drinks', 'Add-ons', 100, true, false, 0);

-- Insert Food
INSERT INTO public.items (name, category, subcategory, price, "isAvailable", "allowUpsize", "upsizePrice", "optionsConfig") VALUES
-- Burgers
('Classic Beef Burger', 'Food', 'Burger', 800, true, false, 0, NULL),
('Crispy Chicken Burger', 'Food', 'Burger', 750, true, false, 0, NULL),
('Gourmet Cheese Burger', 'Food', 'Burger', 950, true, false, 0, NULL),

-- Wraps
('Grilled Chicken Wrap', 'Food', 'Wrap', 650, true, false, 0, NULL),
('Spicy Beef Wrap', 'Food', 'Wrap', 700, true, false, 0, NULL),

-- Chicken Bites
('Spicy Chicken Bites', 'Food', 'Chicken Bites', 550, true, false, 0, NULL),
('Honey Mustard Bites', 'Food', 'Chicken Bites', 600, true, false, 0, NULL),

-- Cheese Treats
('Mozzarella Sticks (4pcs)', 'Food', 'Cheese Treats', 450, true, false, 0, NULL),
('Jalapeno Cheese Poppers', 'Food', 'Cheese Treats', 500, true, false, 0, NULL),

-- Fries
('Plain Fries', 'Food', 'Fries', 300, true, false, 0, NULL),
('Masala Fries', 'Food', 'Fries', 350, true, false, 0, NULL),
('Loaded Cheese Fries', 'Food', 'Fries', 550, true, false, 0, NULL),

-- Combo Meal
('Burger Combo Meal', 'Food', 'Combo Meal', 1200, true, false, 0, NULL),
('Wrap Combo Meal', 'Food', 'Combo Meal', 1000, true, false, 0, NULL),

-- Sauce Dip (REQUIRES SELECTION VIA JSONB)
('Extra Sauce Dip', 'Food', 'Add-ons', 100, true, false, 0, '{"requiresSelection": true, "selectionName": "Sauce", "choices": ["Garlic Mayo", "Smoky Barbecue", "Spicy Chipotle", "Signature Mild Hot Sauce"]}'::jsonb);

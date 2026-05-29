-- Update constraints for Source text
ALTER TABLE orders
DROP CONSTRAINT IF EXISTS orders_source_check;

ALTER TABLE orders
ADD CONSTRAINT orders_source_check
CHECK (source IN ('pos', 'website', 'foodpanda'));

-- Phase 8: Append item_category mapping to order_items to support segregated thermal receipt print copies (kitchen/bar formats)

ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS item_category TEXT,
ADD COLUMN IF NOT EXISTS item_sub_category TEXT;

-- Backfill legacy records cleanly matching current categories!
UPDATE public.order_items oi
SET item_category = i.category,
    item_sub_category = i.subcategory
FROM public.items i
WHERE oi."itemId" = i.id
  AND oi.item_category IS NULL;

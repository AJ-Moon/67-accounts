-- 1. ADD ORDER STATUS FIELDS
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'placed' CHECK (status IN ('placed', 'getting_ready', 'completed', 'cancelled')),
ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'pos' CHECK (source IN ('pos', 'website')),
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS status_updated_by UUID REFERENCES auth.users(id);

-- 2. CREATE STATUS HISTORY AUDIT TABLE
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  note TEXT
);

-- 3. ENABLE PUBLIC API ACCESS TO EXTERNAL ORDER CREATION IN RLS (Optional depending on Supabase setup, but handled server-side securely via service_role bypassing if standard REST is restricted).
-- Because Next.js uses the Secret key or authenticated client for Server-Side, RLS policies remain secure!

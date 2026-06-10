-- RUN THIS IN YOUR SUPABASE SQL EDITOR TO UNLOCK THE LEDGER FOR THE POS

ALTER TABLE public.ledger_transactions ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users (the cashier/admin) to read and write ledger transactions
DROP POLICY IF EXISTS "Allow authenticated select ledger" ON public.ledger_transactions;
CREATE POLICY "Allow authenticated select ledger" ON public.ledger_transactions FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated insert ledger" ON public.ledger_transactions;
CREATE POLICY "Allow authenticated insert ledger" ON public.ledger_transactions FOR INSERT WITH CHECK (auth.role() = 'authenticated');

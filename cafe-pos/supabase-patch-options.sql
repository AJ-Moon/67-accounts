-- Add JSONB payload to items safely
ALTER TABLE public.items 
ADD COLUMN IF NOT EXISTS "optionsConfig" JSONB DEFAULT NULL;

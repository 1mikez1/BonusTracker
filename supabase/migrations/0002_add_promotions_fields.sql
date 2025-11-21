-- Add missing fields to promotions table for CSV data tracking

-- Add profit_type (CASH/VOUCHER)
ALTER TABLE public.promotions 
ADD COLUMN IF NOT EXISTS profit_type text;

-- Add expense (Spesa)
ALTER TABLE public.promotions 
ADD COLUMN IF NOT EXISTS expense numeric(12,2);

-- Add max_invites (Numero inviti)
ALTER TABLE public.promotions 
ADD COLUMN IF NOT EXISTS max_invites integer;

-- Add is_active boolean flag (ATTIVA from CSV)
ALTER TABLE public.promotions 
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Add index on is_active for filtering
CREATE INDEX IF NOT EXISTS idx_promotions_is_active ON public.promotions(is_active);

-- Add index on profit_type for filtering
CREATE INDEX IF NOT EXISTS idx_promotions_profit_type ON public.promotions(profit_type);


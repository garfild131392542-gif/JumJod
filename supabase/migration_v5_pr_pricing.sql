-- Migration v5: Add pricing and VAT columns to pr_requests
ALTER TABLE public.pr_requests 
  ADD COLUMN IF NOT EXISTS subtotal numeric,
  ADD COLUMN IF NOT EXISTS vat_amount numeric,
  ADD COLUMN IF NOT EXISTS total_amount numeric;

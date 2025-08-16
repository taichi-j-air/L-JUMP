-- Add cumulative payment tracking to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_payment_amount NUMERIC DEFAULT 0;

-- Add comment to explain the field
COMMENT ON COLUMN public.profiles.total_payment_amount IS 'Cumulative total of all payments made by this user in cents/smallest currency unit';
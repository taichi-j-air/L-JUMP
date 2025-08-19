-- Add cumulative payment tracking to line_friends table
ALTER TABLE public.line_friends ADD COLUMN IF NOT EXISTS total_payment_amount NUMERIC DEFAULT 0;

-- Add comment to explain the field
COMMENT ON COLUMN public.line_friends.total_payment_amount IS 'Cumulative total of all payments made by this friend in cents/smallest currency unit';
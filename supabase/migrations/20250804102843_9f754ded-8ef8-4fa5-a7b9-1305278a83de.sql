-- First, completely remove the constraint
ALTER TABLE steps DROP CONSTRAINT IF EXISTS steps_delivery_type_check;

-- Update all existing data
UPDATE steps 
SET delivery_type = 'relative' 
WHERE delivery_type = 'after_registration';

-- Add the delivery_time_of_day column for pattern ③
ALTER TABLE steps ADD COLUMN IF NOT EXISTS delivery_time_of_day time;

-- Add the new constraint
ALTER TABLE steps ADD CONSTRAINT steps_delivery_type_check 
CHECK (delivery_type IN ('relative', 'specific_time', 'relative_to_previous'));
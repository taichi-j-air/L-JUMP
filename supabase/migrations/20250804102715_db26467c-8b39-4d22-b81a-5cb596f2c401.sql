-- Update the delivery_type check constraint to support new values
ALTER TABLE steps DROP CONSTRAINT IF EXISTS steps_delivery_type_check;

-- Add new check constraint with updated delivery types
ALTER TABLE steps ADD CONSTRAINT steps_delivery_type_check 
CHECK (delivery_type IN ('relative', 'specific_time', 'relative_to_previous'));

-- Update existing records to use new delivery type values
UPDATE steps 
SET delivery_type = 'relative' 
WHERE delivery_type = 'after_registration';

-- Ensure delivery_time_of_day column exists for pattern ③
ALTER TABLE steps ADD COLUMN IF NOT EXISTS delivery_time_of_day time;
-- Fix duplicate product_settings records by keeping only the latest one for each product
DELETE FROM product_settings a USING product_settings b 
WHERE a.id < b.id AND a.product_id = b.product_id;

-- Add unique constraint to prevent future duplicates
ALTER TABLE product_settings 
ADD CONSTRAINT product_settings_product_id_unique 
UNIQUE (product_id);
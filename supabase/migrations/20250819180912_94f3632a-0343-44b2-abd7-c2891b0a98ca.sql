-- Fix the product type mismatch for テスト商品333
-- This product is marked as subscription but has a one-time price ID
UPDATE products 
SET product_type = 'one_time' 
WHERE id = '26625729-7a7a-42cd-83ed-52cca319724c' 
AND product_type = 'subscription';
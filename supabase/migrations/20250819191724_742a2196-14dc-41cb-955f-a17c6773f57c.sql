-- サブスクリプション商品の注文をすべて削除
DELETE FROM orders 
WHERE status = 'paid' 
AND product_id IN (SELECT id FROM products WHERE product_type = 'subscription');
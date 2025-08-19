-- サブスクリプション商品の注文をすべてキャンセル済みに変更
UPDATE orders 
SET status = 'canceled' 
WHERE status = 'paid' 
AND product_id IN (SELECT id FROM products WHERE product_type = 'subscription');
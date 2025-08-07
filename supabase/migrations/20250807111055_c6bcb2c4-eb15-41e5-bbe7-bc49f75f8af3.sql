-- 完全修正: 無効なURLを強制削除
UPDATE profiles 
SET add_friend_url = NULL 
WHERE add_friend_url = 'https://lin.ee/617apyhj';
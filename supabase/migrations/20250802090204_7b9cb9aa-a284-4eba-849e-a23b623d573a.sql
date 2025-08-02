-- 招待コードを誰でも読み取り可能にするRLSポリシーを追加
CREATE POLICY "招待コードは誰でも参照可能（公開招待用）" 
ON public.scenario_invite_codes 
FOR SELECT 
USING (true);
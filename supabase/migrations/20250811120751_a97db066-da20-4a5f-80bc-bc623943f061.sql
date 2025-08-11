-- 1) Create multi-account table for LINE accounts per user
CREATE TABLE IF NOT EXISTS public.line_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_name text NOT NULL DEFAULT 'メイン',
  line_bot_id text,                -- "@"から始まる公開ID（@を付けずに保存されていても可）
  channel_id text,                 -- LINEチャネルID
  channel_secret text,             -- 機密
  access_token text,               -- 機密
  status text DEFAULT 'not_configured',
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) RLS
ALTER TABLE public.line_accounts ENABLE ROW LEVEL SECURITY;

-- 3) Policies: user can manage their own accounts
CREATE POLICY "select_own_line_accounts"
  ON public.line_accounts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "insert_own_line_accounts"
  ON public.line_accounts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_line_accounts"
  ON public.line_accounts
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "delete_own_line_accounts"
  ON public.line_accounts
  FOR DELETE
  USING (auth.uid() = user_id);

-- 4) Keep updated_at fresh
DROP TRIGGER IF EXISTS trg_line_accounts_updated_at ON public.line_accounts;
CREATE TRIGGER trg_line_accounts_updated_at
BEFORE UPDATE ON public.line_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Only one active account per user
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_line_account_per_user
ON public.line_accounts (user_id)
WHERE is_active = true;

-- 6) Ensure toggling one active turns others off
CREATE OR REPLACE FUNCTION public.ensure_single_active_line_account()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active THEN
    UPDATE public.line_accounts
    SET is_active = false, updated_at = now()
    WHERE user_id = NEW.user_id AND id <> NEW.id AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp';

DROP TRIGGER IF EXISTS trg_single_active_line_account ON public.line_accounts;
CREATE TRIGGER trg_single_active_line_account
AFTER INSERT OR UPDATE OF is_active ON public.line_accounts
FOR EACH ROW
EXECUTE FUNCTION public.ensure_single_active_line_account();

-- 7) Seed from existing profile (best-effort, only if user has no line_accounts yet)
INSERT INTO public.line_accounts (user_id, account_name, line_bot_id, channel_id, status, is_active)
SELECT p.user_id, 'メイン', p.line_bot_id, p.line_channel_id, COALESCE(p.line_api_status, 'not_configured'), true
FROM public.profiles p
WHERE p.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.line_accounts la WHERE la.user_id = p.user_id
  );
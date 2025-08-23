-- 友達別のページアクセス制御テーブルを作成
CREATE TABLE IF NOT EXISTS public.friend_page_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  friend_id UUID NOT NULL,
  page_share_code TEXT NOT NULL,
  scenario_id UUID NULL, -- 配信シナリオID
  step_id UUID NULL, -- 配信ステップID
  first_access_at TIMESTAMP WITH TIME ZONE NULL, -- 初回アクセス時刻
  timer_start_at TIMESTAMP WITH TIME ZONE NULL, -- タイマー開始時刻（シナリオ配信時等）
  timer_end_at TIMESTAMP WITH TIME ZONE NULL, -- タイマー終了時刻
  access_enabled BOOLEAN NOT NULL DEFAULT true, -- アクセス可能かどうか
  access_source TEXT NULL DEFAULT 'manual', -- アクセス許可の元（manual/scenario/recovery等）
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_friend_page UNIQUE (friend_id, page_share_code)
);

-- RLS ポリシーを設定
ALTER TABLE public.friend_page_access ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分の友達のアクセス制御のみ参照可能
CREATE POLICY "users_can_view_own_friend_access" 
ON public.friend_page_access 
FOR SELECT 
USING (auth.uid() = user_id);

-- ユーザーは自分の友達のアクセス制御を作成可能
CREATE POLICY "users_can_create_own_friend_access" 
ON public.friend_page_access 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- ユーザーは自分の友達のアクセス制御を更新可能
CREATE POLICY "users_can_update_own_friend_access" 
ON public.friend_page_access 
FOR UPDATE 
USING (auth.uid() = user_id);

-- ユーザーは自分の友達のアクセス制御を削除可能
CREATE POLICY "users_can_delete_own_friend_access" 
ON public.friend_page_access 
FOR DELETE 
USING (auth.uid() = user_id);

-- システムが友達アクセス制御を管理可能（エッジ関数用）
CREATE POLICY "system_can_manage_friend_access" 
ON public.friend_page_access 
FOR ALL 
USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));

-- タイマーモードにstep_deliveryを追加
ALTER TABLE public.cms_pages 
ADD COLUMN IF NOT EXISTS timer_mode_step_delivery BOOLEAN DEFAULT false;

-- 更新時刻トリガーを追加
CREATE TRIGGER update_friend_page_access_updated_at
  BEFORE UPDATE ON public.friend_page_access
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- インデックスを追加（パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_friend_page_access_friend_share 
ON public.friend_page_access (friend_id, page_share_code);

CREATE INDEX IF NOT EXISTS idx_friend_page_access_user_id 
ON public.friend_page_access (user_id);

CREATE INDEX IF NOT EXISTS idx_friend_page_access_scenario_step 
ON public.friend_page_access (scenario_id, step_id);

-- 友達アクセス制御の関数を作成
CREATE OR REPLACE FUNCTION public.manage_friend_page_access(
  p_friend_id UUID,
  p_page_share_code TEXT,
  p_action TEXT, -- 'enable', 'disable', 'reset_timer', 'set_timer_start'
  p_scenario_id UUID DEFAULT NULL,
  p_step_id UUID DEFAULT NULL,
  p_timer_start_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_user_id UUID;
  v_access_record RECORD;
  v_result JSON;
BEGIN
  -- 友達のuser_idを取得
  SELECT user_id INTO v_user_id
  FROM public.line_friends
  WHERE id = p_friend_id;

  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Friend not found');
  END IF;

  -- 既存のアクセス制御レコードを取得または作成
  SELECT * INTO v_access_record
  FROM public.friend_page_access
  WHERE friend_id = p_friend_id AND page_share_code = p_page_share_code;

  IF v_access_record IS NULL THEN
    -- 新規作成
    INSERT INTO public.friend_page_access (
      user_id, friend_id, page_share_code, scenario_id, step_id,
      access_enabled, access_source
    )
    VALUES (
      v_user_id, p_friend_id, p_page_share_code, p_scenario_id, p_step_id,
      CASE WHEN p_action = 'disable' THEN false ELSE true END,
      CASE 
        WHEN p_scenario_id IS NOT NULL THEN 'scenario'
        WHEN p_action = 'reset_timer' THEN 'recovery'
        ELSE 'manual'
      END
    )
    RETURNING * INTO v_access_record;
  ELSE
    -- 更新
    UPDATE public.friend_page_access
    SET
      access_enabled = CASE
        WHEN p_action = 'enable' THEN true
        WHEN p_action = 'disable' THEN false
        ELSE access_enabled
      END,
      scenario_id = COALESCE(p_scenario_id, scenario_id),
      step_id = COALESCE(p_step_id, step_id),
      timer_start_at = CASE
        WHEN p_action = 'set_timer_start' THEN COALESCE(p_timer_start_at, now())
        WHEN p_action = 'reset_timer' THEN now()
        ELSE timer_start_at
      END,
      first_access_at = CASE
        WHEN p_action = 'reset_timer' THEN NULL
        ELSE first_access_at
      END,
      access_source = CASE
        WHEN p_scenario_id IS NOT NULL THEN 'scenario'
        WHEN p_action = 'reset_timer' THEN 'recovery'
        ELSE access_source
      END,
      updated_at = now()
    WHERE friend_id = p_friend_id AND page_share_code = p_page_share_code
    RETURNING * INTO v_access_record;
  END IF;

  v_result := json_build_object(
    'success', true,
    'access_record', row_to_json(v_access_record)
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;
-- Create enum types for status fields
CREATE TYPE affiliate_commission_status AS ENUM ('pending', 'approved', 'paid', 'cancelled');
CREATE TYPE affiliate_payout_status AS ENUM ('processing', 'completed', 'failed');

-- 1. affiliate_ranks（ランク管理テーブル）- 先に作成（他テーブルから参照されるため）
CREATE TABLE public.affiliate_ranks (
  id SERIAL PRIMARY KEY,
  rank_name TEXT NOT NULL UNIQUE,
  commission_signup_amount INTEGER NOT NULL DEFAULT 0,
  commission_subscription_rate DECIMAL(5,4) NOT NULL DEFAULT 0.0000,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- デフォルトランクを挿入
INSERT INTO public.affiliate_ranks (rank_name, commission_signup_amount, commission_subscription_rate, description) VALUES
('Default', 500, 0.2000, 'デフォルトランク'),
('Bronze', 750, 0.2500, 'ブロンズランク'),
('Silver', 1000, 0.3000, 'シルバーランク'),
('Gold', 1500, 0.3500, 'ゴールドランク');

-- 2. affiliate_referrals（紹介記録テーブル）
CREATE TABLE public.affiliate_referrals (
  id BIGSERIAL PRIMARY KEY,
  referrer_id UUID NOT NULL,
  referred_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(referrer_id, referred_id)
);

-- 3. affiliate_commissions（報酬発生記録テーブル）
CREATE TABLE public.affiliate_commissions (
  id BIGSERIAL PRIMARY KEY,
  referral_id BIGINT REFERENCES public.affiliate_referrals(id) ON DELETE CASCADE,
  affiliate_id UUID NOT NULL,
  source_event TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  status affiliate_commission_status NOT NULL DEFAULT 'pending',
  payout_id BIGINT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  approved_at TIMESTAMP WITH TIME ZONE
);

-- 4. affiliate_payouts（支払い履歴テーブル）
CREATE TABLE public.affiliate_payouts (
  id BIGSERIAL PRIMARY KEY,
  affiliate_id UUID NOT NULL,
  total_amount INTEGER NOT NULL CHECK (total_amount > 0),
  status affiliate_payout_status NOT NULL DEFAULT 'processing',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- affiliate_commissionsテーブルの外部キー制約を追加
ALTER TABLE public.affiliate_commissions 
ADD CONSTRAINT fk_affiliate_commissions_payout 
FOREIGN KEY (payout_id) REFERENCES public.affiliate_payouts(id) ON DELETE SET NULL;

-- 5. affiliate_payout_settings（支払い設定テーブル）
CREATE TABLE public.affiliate_payout_settings (
  affiliate_id UUID PRIMARY KEY,
  payout_method TEXT NOT NULL DEFAULT 'bank_transfer',
  bank_name TEXT, -- 暗号化予定
  branch_name TEXT, -- 暗号化予定
  account_holder_name TEXT, -- 暗号化予定
  account_type TEXT, -- 暗号化予定
  account_number TEXT, -- 暗号化予定
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. affiliate_program_settings（プログラム設定テーブル）
CREATE TABLE public.affiliate_program_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- デフォルト設定を挿入
INSERT INTO public.affiliate_program_settings (key, value, description) VALUES
('terms_of_service', 'L!JUMPアフィリエイトプログラム利用規約

1. 概要
本規約は、L!JUMPアフィリエイトプログラムの利用に関する条件を定めるものです。

2. 報酬について
・新規ユーザー登録：1件につき500円
・有料プランへの初回アップグレード：1件につき2,000円

3. 支払いについて
・報酬は月末締め、翌月末払いとします
・最低支払額は3,000円からとなります

4. 禁止事項
・虚偽の情報による紹介
・スパム行為
・その他不正な手段による紹介

本規約は予告なく変更される場合があります。', 'アフィリエイトプログラムの利用規約'),
('minimum_payout_amount', '3000', '最低支払額（円）'),
('commission_approval_days', '30', '報酬承認までの日数');

-- 7. profilesテーブルにaffiliate_rank_idカラムを追加
ALTER TABLE public.profiles 
ADD COLUMN affiliate_rank_id INTEGER REFERENCES public.affiliate_ranks(id) DEFAULT 1;

-- インデックス作成
CREATE INDEX idx_affiliate_referrals_referrer ON public.affiliate_referrals(referrer_id);
CREATE INDEX idx_affiliate_referrals_referred ON public.affiliate_referrals(referred_id);
CREATE INDEX idx_affiliate_commissions_affiliate ON public.affiliate_commissions(affiliate_id);
CREATE INDEX idx_affiliate_commissions_status ON public.affiliate_commissions(status);
CREATE INDEX idx_affiliate_commissions_created ON public.affiliate_commissions(created_at);
CREATE INDEX idx_affiliate_payouts_affiliate ON public.affiliate_payouts(affiliate_id);
CREATE INDEX idx_affiliate_payouts_status ON public.affiliate_payouts(status);

-- updated_at自動更新トリガー関数（既存のものを使用）
CREATE TRIGGER update_affiliate_payout_settings_updated_at
  BEFORE UPDATE ON public.affiliate_payout_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_affiliate_program_settings_updated_at
  BEFORE UPDATE ON public.affiliate_program_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS有効化
ALTER TABLE public.affiliate_ranks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_payout_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_program_settings ENABLE ROW LEVEL SECURITY;

-- RLSポリシー設定

-- affiliate_ranks: 全ユーザー読み取り可能、開発者のみ管理
CREATE POLICY "Everyone can read affiliate ranks" ON public.affiliate_ranks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Developers can manage affiliate ranks" ON public.affiliate_ranks FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND user_role = 'developer'));

-- affiliate_referrals: 関係者のみ閲覧
CREATE POLICY "Users can view their referrals" ON public.affiliate_referrals FOR SELECT TO authenticated 
USING (referrer_id = auth.uid() OR referred_id = auth.uid());
CREATE POLICY "Users can create referrals" ON public.affiliate_referrals FOR INSERT TO authenticated 
WITH CHECK (referrer_id = auth.uid());

-- affiliate_commissions: 自分の報酬のみ閲覧
CREATE POLICY "Users can view their commissions" ON public.affiliate_commissions FOR SELECT TO authenticated 
USING (affiliate_id = auth.uid());
CREATE POLICY "System can manage commissions" ON public.affiliate_commissions FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND user_role = 'developer'));

-- affiliate_payouts: 自分の支払い履歴のみ閲覧
CREATE POLICY "Users can view their payouts" ON public.affiliate_payouts FOR SELECT TO authenticated 
USING (affiliate_id = auth.uid());
CREATE POLICY "System can manage payouts" ON public.affiliate_payouts FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND user_role = 'developer'));

-- affiliate_payout_settings: 自分の設定のみ管理
CREATE POLICY "Users can manage their payout settings" ON public.affiliate_payout_settings FOR ALL TO authenticated 
USING (affiliate_id = auth.uid()) WITH CHECK (affiliate_id = auth.uid());

-- affiliate_program_settings: 全ユーザー読み取り可能、開発者のみ管理
CREATE POLICY "Everyone can read program settings" ON public.affiliate_program_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Developers can manage program settings" ON public.affiliate_program_settings FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND user_role = 'developer'));
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ==== 設定 ====
const LINE_LOGIN_REDIRECT_URI = "https://xxxx.supabase.co/functions/v1/login-callback"; // ←コールバック関数のエンドポイント
const LINE_SCOPE = "profile openid";
const BOT_PROMPT = "aggressive";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const inviteCode = url.searchParams.get("code");
  if (!inviteCode) {
    return new Response("招待コードが必要です", { status: 400, headers: corsHeaders });
  }

  // Supabaseでシナリオ情報を取得（チャンネルID/BOT ID判別用）
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const { data, error } = await supabase
    .from("scenario_invite_codes")
    .select(`
      id,
      scenario_id,
      invite_code,
      step_scenarios!inner (
        profiles!inner (
          line_login_channel_id,
          line_bot_id
        )
      )
    `)
    .eq("invite_code", inviteCode)
    .eq("is_active", true)
    .single();

  if (error || !data) {
    return new Response("無効な招待コード", { status: 404, headers: corsHeaders });
  }

  const channelId = data.step_scenarios.profiles.line_login_channel_id;
  const botId = data.step_scenarios.profiles.line_bot_id;

  if (!channelId || !botId) {
    return new Response("LINE設定が不完全です", { status: 500, headers: corsHeaders });
  }

  // 友だち追加＋認証URLを生成
  const params = new URLSearchParams({
    response_type: "code",
    client_id: channelId,
    redirect_uri: LINE_LOGIN_REDIRECT_URI,
    state: inviteCode,
    scope: LINE_SCOPE,
    bot_prompt: BOT_PROMPT,
  });

  const authUrl = `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`;

  // すぐに認証フローへリダイレクト
  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders,
      Location: authUrl,
    },
  });
});

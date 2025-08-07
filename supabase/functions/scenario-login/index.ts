import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  validateInviteCode, 
  rateLimiter,
  createSecureHeaders,
  createErrorResponse 
} from '../_shared/security.ts'

const corsHeaders = createSecureHeaders();

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting check
  const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const rateAllowed = await rateLimiter.isAllowed(`scenario-login:${clientIP}`, 5, 60000); // 5 requests per minute
  
  if (!rateAllowed) {
    console.warn('Rate limit exceeded for scenario login, IP:', clientIP);
    return createErrorResponse('Rate limit exceeded', 429);
  }

  try {
    console.log("=== SCENARIO LOGIN START ===");

    const url = new URL(req.url);
    const scenario = url.searchParams.get("scenario");

    console.log("Scenario login request for:", scenario);

    if (!scenario) {
      console.error("Missing scenario parameter");
      return createErrorResponse("Scenario parameter is required", 400);
    }

    if (!validateInviteCode(scenario)) {
      console.error("Invalid scenario code format:", scenario);
      return createErrorResponse("Invalid scenario code format", 400);
    }

    // Initialize Supabase
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // シナリオ情報とプロファイル設定を取得（LINE公式アカウントID優先）
    const { data, error } = await supabase
      .from("scenario_invite_codes")
      .select(`
        step_scenarios!inner (
          profiles!inner (
            line_bot_id,
            add_friend_url,
            display_name
          )
        )
      `)
      .eq("invite_code", scenario)
      .eq("is_active", true)
      .maybeSingle();

    if (error || !data) {
      console.error("Scenario not found:", error, "Data:", data);
      return createErrorResponse("Invalid scenario code", 404);
    }

    const profile = data.step_scenarios.profiles;
    console.log("Profile found:", { 
      hasLineBotId: !!profile.line_bot_id, 
      hasAddFriendUrl: !!profile.add_friend_url 
    });
    
    // 認証フロー選択（デフォルト: LINE Login OAuthで即時特定→配信）
    const flow = url.searchParams.get("flow") || "login"; // "login" | "oa"

    // LINE Login OAuth 認可URLを生成（LIFFは不使用）
    const redirectUri = "https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/login-callback";
    let authUrl: string | null = null;
    if (profile.line_login_channel_id && profile.line_login_channel_secret) {
      const params = new URLSearchParams({
        response_type: "code",
        client_id: profile.line_login_channel_id,
        redirect_uri: redirectUri,
        state: scenario, // 招待コードをstateに保持し、コールバックで登録＆即時配信
        scope: "openid profile",
        bot_prompt: "normal", // 未フォローなら友だち追加を促す
      });
      authUrl = `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`;
    }

    // 互換: oaMessage URL（手入力トリガー用）
    const inviteMessage = `#INVITE ${scenario}`;
    let oaMessageUrl: string | null = null;
    if (profile.line_bot_id) {
      oaMessageUrl = `https://line.me/R/oaMessage/${encodeURIComponent(profile.line_bot_id)}/${encodeURIComponent(inviteMessage)}`;
    } else if (profile.add_friend_url) {
      oaMessageUrl = profile.add_friend_url;
    }

    // 使用するURLを決定
    const selectedUrl = (flow === "oa" ? oaMessageUrl : authUrl) || oaMessageUrl || authUrl;
    if (!selectedUrl) {
      console.error("No valid URL could be generated for scenario:", scenario);
      return createErrorResponse("LINE configuration not set for this scenario", 500);
    }

    // Click logging for invite correlation
    try {
      const userAgent = req.headers.get('user-agent') || '';
      const referer = req.headers.get('referer');
      const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
      await supabase.from('invite_clicks').insert({
        invite_code: scenario,
        user_agent: userAgent,
        referer,
        ip
      });
    } catch (e) {
      console.warn('Failed to log invite click:', e);
    }

    // デスクトップ用: JSONでURLを返す（フロントでQR表示用）
    const format = url.searchParams.get("format");
    if (format === "json") {
      const body = JSON.stringify({
        success: true,
        authorizeUrl: selectedUrl, // フロント側はこのURLを開けばOK
        scenario,
      });
      return new Response(body, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log("Selected login flow for scenario:", scenario, "flow:", flow);
    console.log("Redirecting to:", selectedUrl);

    // それ以外はそのままリダイレクト（ログイン or OAメッセージ）
    return Response.redirect(selectedUrl, 302);

  } catch (e: any) {
    console.error("Scenario login error:", e);
    return createErrorResponse(
      "Internal server error: " + (e.message || String(e)), 
      500
    );
  }
});
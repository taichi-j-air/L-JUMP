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
            display_name,
            line_login_channel_id,
            line_login_channel_secret,
            liff_id,
            liff_url
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

    // Collect optional attribution params
    const campaign = url.searchParams.get("campaign") || null;
    const source = url.searchParams.get("source") || null;

    // LINE Login OAuth 認可URLを生成（LIFFは不使用）
    const redirectUri = "https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/login-callback";
    let authUrl: string | null = null;
    if (profile.line_login_channel_id && profile.line_login_channel_secret) {
      // Encode state as Base64URL JSON to carry scenario/campaign/source safely
      const statePayload = { scenario, campaign, source, t: Date.now() };
      const encodedState = btoa(JSON.stringify(statePayload))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/,"");

      const params = new URLSearchParams({
        response_type: "code",
        client_id: profile.line_login_channel_id,
        redirect_uri: redirectUri,
        state: encodedState, // 招待コード等をstateに保持し、コールバックで登録＆即時配信
        scope: "openid profile",
        bot_prompt: "normal", // 未フォローなら友だち追加を促す
      });
      authUrl = `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`;
    }

    // チャット/友だち追加用URL（プレフィル無し）
    let chatUrl: string | null = null;
    if (profile.add_friend_url) {
      chatUrl = profile.add_friend_url;
    } else if (profile.line_bot_id) {
      chatUrl = `https://line.me/R/ti/p/${encodeURIComponent(profile.line_bot_id)}`;
    }

    // LIFF起動用URL（スマホ外部ブラウザ→LINEアプリ遷移対策）
    let liffUrl: string | null = null;
    if ((profile as any).liff_id) {
      const qs = new URLSearchParams({ inviteCode: scenario!, ...(campaign ? { campaign } : {}), ...(source ? { source } : {}) })
      liffUrl = `https://liff.line.me/${(profile as any).liff_id}?${qs.toString()}`
    } else if ((profile as any).liff_url) {
      const qs = new URLSearchParams({ inviteCode: scenario!, ...(campaign ? { campaign } : {}), ...(source ? { source } : {}) })
      liffUrl = `${(profile as any).liff_url}?${qs.toString()}`
    }

    // 使用するURLを決定（スマホ外部ブラウザならLIFF優先）
    const userAgent = req.headers.get('user-agent') || '';
    const isMobile = /iPhone|iPad|iPod|Android/i.test(userAgent);
    const isLineInApp = /Line\//i.test(userAgent);

    let selectedUrl = (flow === "login" && authUrl) ? authUrl : (authUrl || chatUrl);
    if (isMobile && !isLineInApp && liffUrl) {
      selectedUrl = liffUrl;
    }

    if (!selectedUrl) {
      console.error("No valid URL could be generated for scenario:", scenario);
      return createErrorResponse("LINE configuration not set for this scenario", 500);
    }

    // Click logging for invite correlation
    try {
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
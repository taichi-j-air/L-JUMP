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

    // シナリオ情報とプロファイル設定を取得
    const { data, error } = await supabase
      .from("scenario_invite_codes")
      .select(`
        step_scenarios!inner (
          profiles!inner (
            line_login_channel_id,
            line_login_channel_secret,
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
      hasChannelId: !!profile.line_login_channel_id, 
      hasChannelSecret: !!profile.line_login_channel_secret 
    });
    
    if (!profile.line_login_channel_id || !profile.line_login_channel_secret) {
      console.error("LINE login not configured for scenario:", scenario);
      return createErrorResponse("LINE login not configured for this scenario", 500);
    }

    // LINEログイン認証URLを生成
    const redirectUri = "https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/login-callback";
    const lineLoginUrl = 
      `https://access.line.me/oauth2/v2.1/authorize` +
      `?response_type=code` +
      `&client_id=${profile.line_login_channel_id}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${scenario}` +
      `&scope=profile%20openid` +
      `&bot_prompt=aggressive` +
      `&prompt=consent` +
      `&ui_locales=ja-JP`;

    // デスクトップ用: JSONでURLを返す（フロントでQR表示用）
    const format = url.searchParams.get("format");
    if (format === "json") {
      const body = JSON.stringify({
        success: true,
        authorizeUrl: lineLoginUrl,
        scenario,
      });
      return new Response(body, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log("Generated LINE login URL for scenario:", scenario);
    console.log("Redirecting to:", lineLoginUrl);

    // それ以外はそのままリダイレクト
    return Response.redirect(lineLoginUrl, 302);

  } catch (e: any) {
    console.error("Scenario login error:", e);
    return createErrorResponse(
      "Internal server error: " + (e.message || String(e)), 
      500
    );
  }
});
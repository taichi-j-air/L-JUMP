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
    
    // LINEアプリを直接起動するURL（oaMessage）を生成
    const inviteMessage = `#INVITE ${scenario}`;
    let oaMessageUrl: string | null = null;

    if (profile.line_bot_id) {
      oaMessageUrl = `https://line.me/R/oaMessage/${encodeURIComponent(profile.line_bot_id)}/${encodeURIComponent(inviteMessage)}`;
    } else if (profile.add_friend_url) {
      // 予備: 友だち追加URL（メッセージ送信はできないため、ユーザーに #INVITE を送ってもらう運用）
      oaMessageUrl = profile.add_friend_url;
    } else {
      console.error("LINE Bot information not configured for scenario:", scenario);
      return createErrorResponse("LINE Bot not configured for this scenario", 500);
    }

    // デスクトップ用: JSONでURLを返す（フロントでQR表示用）
    const format = url.searchParams.get("format");
    if (format === "json") {
      const body = JSON.stringify({
        success: true,
        authorizeUrl: oaMessageUrl, // 互換のためフィールド名は維持
        scenario,
      });
      return new Response(body, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log("Generated LINE oaMessage URL for scenario:", scenario);
    console.log("Redirecting to:", oaMessageUrl);

    // それ以外はそのままリダイレクト（スマホでLINEアプリ起動）
    return Response.redirect(oaMessageUrl, 302);

  } catch (e: any) {
    console.error("Scenario login error:", e);
    return createErrorResponse(
      "Internal server error: " + (e.message || String(e)), 
      500
    );
  }
});
// supabase/functions/scenario-invite/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// User-Agent判定ヘルパー
function getUserAgentInfo(userAgent: string) {
  const ua = userAgent.toLowerCase();
  const isLINEApp = ua.includes('line/');
  const isMobile = /mobile|android|iphone|ipad|ipod/.test(ua);
  const isDesktop = !isMobile;
  
  return { isLINEApp, isMobile, isDesktop };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const url = new URL(req.url);
  const inviteCode = url.searchParams.get("code");
  if (!inviteCode) {
    // クエリなしアクセスは何もしない（LINEプリフェッチ対策）
    return new Response(null, { status: 204, headers: cors });
  }

  console.log("=== scenario-invite START ===");
  console.log("Invite code:", inviteCode);

  try {
    // DB 取得
    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    
    // 招待コードと関連ユーザーを取得
    const { data: invite, error: inviteErr } = await db
      .from("scenario_invite_codes")
      .select("scenario_id, user_id, max_usage, usage_count, is_active")
      .eq("invite_code", inviteCode)
      .eq("is_active", true)
      .single();

    if (inviteErr || !invite) {
      console.warn("Invalid invite code:", inviteCode, inviteErr?.message);
      return new Response("Invalid invite code", { status: 404, headers: cors });
    }

    // プロファイル（LINE Login設定）取得
    const { data: profile, error: profileErr } = await db
      .from("profiles")
      .select("line_login_channel_id, line_login_channel_secret, line_api_status, display_name, line_bot_id, add_friend_url")
      .eq("user_id", invite.user_id)
      .single();

    if (profileErr || !profile) {
      console.error("Profile not found for user:", invite.user_id, profileErr?.message);
      return new Response("Profile not found", { status: 404, headers: cors });
    }

    // 使用制限チェック
    if (invite.max_usage && invite.usage_count >= invite.max_usage) {
      console.warn("Usage limit exceeded for invite:", inviteCode);
      return new Response("Usage limit exceeded", { status: 410, headers: cors });
    }

    // API状態確認
    if (profile.line_api_status !== "active" && profile.line_api_status !== "configured") {
      console.warn("LINE API not configured:", profile.line_api_status);
      return new Response("Service not available", { status: 503, headers: cors });
    }

    // 使用カウント更新
    const { error: updateError } = await db
      .from("scenario_invite_codes")
      .update({ usage_count: invite.usage_count + 1 })
      .eq("invite_code", inviteCode);

    if (updateError) {
      console.error("Failed to update usage count:", updateError);
    }

    // クリックログを記録
    const userAgent = req.headers.get('user-agent') || 'unknown';
    const { error: clickError } = await db
      .from("invite_clicks")
      .insert({
        invite_code: inviteCode,
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
        user_agent: userAgent,
        referer: req.headers.get('referer') || null
      });

    if (clickError) {
      console.error('Click log insert error:', clickError);
    }

    // User-Agent判定
    const { isLINEApp, isMobile, isDesktop } = getUserAgentInfo(userAgent);
    console.log("Device info:", { isLINEApp, isMobile, isDesktop });

    // LINE Login設定がある場合はOAuth認証へ
    if (profile.line_login_channel_id && profile.line_login_channel_secret) {
      const channelId = profile.line_login_channel_id;
      const callbackUrl = `https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/login-callback`;
      
      // state parameterに招待コードとシナリオIDを含める
      const state = btoa(JSON.stringify({
        inviteCode,
        scenarioId: invite.scenario_id,
        userId: invite.user_id
      }));

      const authUrl = `https://access.line.me/oauth2/v2.1/authorize?` +
        `response_type=code&` +
        `client_id=${channelId}&` +
        `redirect_uri=${encodeURIComponent(callbackUrl)}&` +
        `state=${encodeURIComponent(state)}&` +
        `scope=profile%20openid`;

      console.log("Redirecting to LINE OAuth:", { authUrl, isMobile, isDesktop });

      // モバイルは直接リダイレクト、デスクトップはQRコード表示用にJSON返却
      if (isMobile || isLINEApp) {
        return new Response(null, {
          status: 302,
          headers: { ...cors, Location: authUrl }
        });
      } else {
        // デスクトップの場合はJSONで返す（将来的にQRコード表示ページを作る場合に備えて）
        return new Response(
          JSON.stringify({ 
            success: true, 
            authUrl,
            displayName: profile.display_name 
          }),
          {
            status: 200,
            headers: { ...cors, "Content-Type": "application/json" }
          }
        );
      }
    }

    // LINE Login設定がない場合は友だち追加URLへフォールバック
    if (profile.add_friend_url) {
      console.log("Fallback to add friend URL:", profile.add_friend_url);
      return new Response(null, {
        status: 302,
        headers: { ...cors, Location: profile.add_friend_url }
      });
    }

    // 設定が不完全な場合
    console.error("Incomplete LINE configuration for invite:", inviteCode);
    return new Response("LINE configuration incomplete", { status: 500, headers: cors });

  } catch (error) {
    console.error("Scenario invite error:", error);
    return new Response("Internal server error", { 
      status: 500, 
      headers: cors 
    });
  }
});

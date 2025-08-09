// supabase/functions/scenario-invite/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
    
    // 招待コードと関連ユーザーを取得（埋め込みを避けて明示クエリ）
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
      .select("line_login_channel_id, line_login_channel_secret, line_api_status, display_name")
      .eq("user_id", invite.user_id)
      .single();

    if (profileErr || !profile) {
      console.error("Profile not found for user:", invite.user_id, profileErr?.message);
      return new Response("Profile not found", { status: 404, headers: cors });
    }

    // LINE Login設定確認
    if (!profile.line_login_channel_id || !profile.line_login_channel_secret) {
      console.error("Missing LINE Login config for invite:", inviteCode, {
        hasChannelId: !!profile.line_login_channel_id,
        hasChannelSecret: !!profile.line_login_channel_secret,
      });
      return new Response("LINE Login not configured", { status: 500, headers: cors });
    }

    // 使用制限チェック
    if (invite.max_usage && invite.usage_count >= invite.max_usage) {
      console.warn("Usage limit exceeded for invite:", inviteCode);
      return new Response("Usage limit exceeded", { status: 410, headers: cors });
    }

    // API状態確認 - 'configured' も許可
    if (profile.line_api_status !== "active" && profile.line_api_status !== "configured") {
      console.warn(
        "LINE API not configured for invite:",
        inviteCode,
        "Status:",
        profile.line_api_status,
      );
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
    const { error: clickError } = await db
      .from("invite_clicks")
      .insert({
        invite_code: inviteCode,
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
        user_agent: req.headers.get('user-agent') || 'unknown',
        referer: req.headers.get('referer') || null
      });

    if (clickError) {
      console.error('Click log insert error:', clickError);
    }

    // 招待ページへリダイレクト（ドメインは優先順で決定: 環境変数 > Referer > 既定）
    const envBase = Deno.env.get('FE_BASE_URL');
    const referer = req.headers.get('referer');
    let feBase = envBase || null;
    if (!feBase && referer) {
      try { feBase = new URL(referer).origin; } catch {}
    }
    // TODO: 必要に応じて既定値をあなたのフロントエンドURLに変更してください
    feBase = feBase || "https://74048ab5-8d5a-425a-ab29-bd5cc50dc2fe.lovableproject.com";

    const redirectUrl = `${feBase}/invite/${encodeURIComponent(inviteCode)}`;

    console.log("Redirect to invite page:", redirectUrl);
    console.log("Profile info:", {
      userId: invite.user_id,
      displayName: profile.display_name,
      hasLineLogin: !!profile.line_login_channel_id,
    });

    return new Response(null, {
      status: 302,
      headers: { ...cors, Location: redirectUrl },
    });

  } catch (error) {
    console.error("Scenario invite error:", error);
    return new Response("Internal server error", { 
      status: 500, 
      headers: cors 
    });
  }
});

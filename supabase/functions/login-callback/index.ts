import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("=== LOGIN CALLBACK START ===");
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");     // ← 招待コードをそのまま入れる
    const error = url.searchParams.get("error");
    const friendshipStatusChanged = url.searchParams.get("friendship_status_changed");

    console.log("Callback parameters:", { code: !!code, state, error, friendshipStatusChanged });

    // SECURITY: Enhanced input validation
    if (error) {
      console.log("LINE OAuth error received:", error);
      throw new Error("LINE authentication failed: " + error);
    }
    
    if (!code || !/^[a-zA-Z0-9._-]+$/.test(code)) {
      console.log("Invalid or missing authorization code");
      throw new Error("Invalid authorization code format");
    }
    
    if (!state || !/^[a-zA-Z0-9]{8,32}$/.test(state)) {
      console.log("Invalid or missing invite code in state parameter");
      throw new Error("Invalid invite code format");
    }

    /* ---------- Supabase ---------- */
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    /* ---------- 招待コード由来の設定取得 ---------- */
    const { data: cfg } = await supabase
      .from("scenario_invite_codes")
      .select(`
        step_scenarios!inner (
          user_id,
          profiles!inner (
            line_login_channel_id,
            line_login_channel_secret,
            display_name
          )
        )
      `)
      .eq("invite_code", state)
      .single();

    if (!cfg?.step_scenarios?.profiles) throw new Error("Profile not found");

    const profileCfg = cfg.step_scenarios.profiles;

    /* ---------- token 取得 ---------- */
    const redirectUri =
      "https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/login-callback";

    const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: profileCfg.line_login_channel_id,
        client_secret: profileCfg.line_login_channel_secret,
      }),
    });

    const ct = tokenRes.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) {
      const body = await tokenRes.text();
      throw new Error("LINE token non-JSON: " + body.slice(0, 80));
    }
    const token = await tokenRes.json();

    /* ---------- LINE プロフィール ---------- */
    const profRes = await fetch("https://api.line.me/v2/profile", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const lineProfile = await profRes.json();

    // SECURITY: Validate and sanitize LINE profile data
    if (!lineProfile.userId || !/^U[0-9a-fA-F]{32}$/.test(lineProfile.userId)) {
      console.log("Invalid LINE user ID format:", lineProfile.userId);
      throw new Error("Invalid LINE user ID format");
    }

    // Sanitize display name to prevent XSS
    const sanitizedDisplayName = lineProfile.displayName ? 
      lineProfile.displayName
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/javascript:/gi, '') // Remove javascript: URLs
        .replace(/data:/gi, '') // Remove data: URLs
        .trim()
        .substring(0, 100) : // Limit length
      null;

    /* ---------- line_friends upsert ---------- */
    await supabase.from("line_friends").upsert({
      user_id: profileCfg.user_id,
      line_user_id: lineProfile.userId,
      display_name: sanitizedDisplayName,
      picture_url: lineProfile.pictureUrl ?? null,
    });

    /* ---------- シナリオ登録 & RPC ---------- */
    const { data: reg } = await supabase.rpc("register_friend_to_scenario", {
      p_line_user_id: lineProfile.userId,
      p_invite_code: state,
      p_display_name: sanitizedDisplayName,
      p_picture_url: lineProfile.pictureUrl ?? null,
    });

    if (!reg?.success) throw new Error("register_friend_to_scenario failed");

    /* ---------- 完了画面へ ---------- */
    // LINEユーザーには友達追加完了画面を表示
    const completionUrl = new URL(`https://74048ab5-8d5a-425a-ab29-bd5cc50dc2fe.lovableproject.com/`);
    completionUrl.searchParams.set('line_login', 'success');
    completionUrl.searchParams.set('user_name', encodeURIComponent(sanitizedDisplayName || 'LINEユーザー'));
    completionUrl.searchParams.set('scenario_registered', 'true');
    
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: completionUrl.toString(),
      },
    });
  } catch (e) {
    console.error("callback error:", e);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
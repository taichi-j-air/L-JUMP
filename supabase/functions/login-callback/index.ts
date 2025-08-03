// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/* ────────────────────────────── */
/*  Main entry (Edge Function)    */
/* ────────────────────────────── */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("=== LOGIN CALLBACK START ===");

    /* ── 1. パラメータ取得 & バリデーション ── */
    const url = new URL(req.url);
    const code  = url.searchParams.get("code");
    const state = url.searchParams.get("state");   // ← 招待コード
    const err   = url.searchParams.get("error");

    console.log("Callback parameters:", { code: !!code, state, err });

    if (err)      throw new Error("LINE authentication error: " + err);
    if (!code)    throw new Error("Missing authorization code");
    if (!state)   throw new Error("Missing invite code (state)");

    /* ── 2. Supabase 初期化 ── */
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    /* ── 3. 招待コード由来の設定取得 ── */
    const { data: cfg, error: cfgErr } = await supabase
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
      .eq("is_active", true)
      .single();

    if (cfgErr || !cfg?.step_scenarios?.profiles) {
      throw new Error("Profile not found for invite code " + state);
    }
    const profile = cfg.step_scenarios.profiles;

    /* ── 4. LINE /token でアクセストークン取得 ── */
    const redirectUri =
      "https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/login-callback";

    const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: profile.line_login_channel_id,
        client_secret: profile.line_login_channel_secret,
      }),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      throw new Error("Token exchange failed: " + text.slice(0, 120));
    }
    const token = await tokenRes.json() as {
      access_token: string;
      id_token: string;
      expires_in: number;
    };

    /* ── 5. LINE プロフィール取得 ── */
    const profRes = await fetch("https://api.line.me/v2/profile", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!profRes.ok) {
      const text = await profRes.text();
      throw new Error("Profile fetch failed: " + text.slice(0, 120));
    }
    const lineProfile = await profRes.json() as {
      userId: string;
      displayName: string;
      pictureUrl?: string;
    };

    /* ── 6. データサニタイズ ── */
    const display = (lineProfile.displayName ?? "")
      .replace(/<[^>]*>/g, "")
      .trim()
      .slice(0, 100);

    /* ── 7. line_friends upsert ── */
    await supabase.from("line_friends").upsert({
      user_id: profile.user_id,
      line_user_id: lineProfile.userId,
      display_name: display,
      picture_url : lineProfile.pictureUrl ?? null,
    });

    /* ── 8. シナリオ登録 RPC ── */
    const { data: reg, error: regErr } = await supabase.rpc(
      "register_friend_to_scenario",
      {
        p_line_user_id: lineProfile.userId,
        p_invite_code : state,
        p_display_name: display,
        p_picture_url : lineProfile.pictureUrl ?? null,
      },
    );

    if (regErr || !reg?.success) {
      throw new Error("register_friend_to_scenario failed");
    }

    /* ── 9. 完了ページへリダイレクト ── */
    return Response.redirect(
      "https://74048ab5-8d5a-425a-ab29-bd5cc50dc2fe.lovableproject.com/?ok=1",
      302,
    );
  } catch (e: any) {
    console.error("callback error:", e);
    return new Response(
      JSON.stringify({ error: String(e.message ?? e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

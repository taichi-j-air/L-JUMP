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
    const state = url.searchParams.get("state"); // ← 招待コード、または 'login' [5]

    console.log("Callback parameters:", { code: !!code, state, error: url.searchParams.get("error"), friendshipStatusChanged: url.searchParams.get("friendship_status_changed") });

    // SECURITY: Enhanced input validation
    const errorParam = url.searchParams.get("error");
    if (errorParam) {
      console.log("LINE OAuth error received:", errorParam);
      throw new Error("LINE authentication failed: " + errorParam);
    }

    if (!code || !/^[a-zA-Z0-9._-]+$/.test(code)) {
      console.log("Invalid or missing authorization code");
      throw new Error("Invalid authorization code format");
    }

    // ★ 修正点1: stateの検証ロジックを緩和し、'login'も許可する
    let isInviteCodeFlow = false;
    if (state === 'login') {
      console.log("Detected general login flow (state='login')");
      isInviteCodeFlow = false;
    } else if (state && /^[a-zA-Z0-9]{8,32}$/.test(state)) { // 招待コードの正規表現 [6]
      console.log("Detected invite code login flow");
      isInviteCodeFlow = true;
    } else {
      console.log("Invalid or missing state parameter. Expected 'login' or valid invite code format. Received:", state);
      throw new Error("Invalid state parameter format");
    }

    /* ---------- Supabase ---------- */
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let profileCfg: {
      user_id: string;
      line_login_channel_id: string;
      line_login_channel_secret: string;
      display_name: string;
    } | null = null;
    let inviteCodeUsed: string | null = null; // 実際に利用された招待コードを保持 (一般ログインではnull)

    // ★ 修正点2: stateの値によって、プロファイル設定の取得方法を分岐する
    if (isInviteCodeFlow) {
      // 招待コードフローの既存ロジック [3]
      console.log("Retrieving config via invite code:", state);
      const { data: cfg, error: inviteCodeCfgError } = await supabase
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

      if (inviteCodeCfgError || !cfg?.step_scenarios?.profiles) {
        console.error("Profile not found for invite code:", state, inviteCodeCfgError);
        throw new Error("Profile not found for invite code.");
      }
      profileCfg = cfg.step_scenarios.profiles;
      inviteCodeUsed = state; // state自体が招待コード
    } else {
      // 一般ログインフロー ('login' state) のための新しいロジック
      // ★ 重要な仮定: 任意の有効なLINEログインチャネル設定を持つプロファイルを使用
      console.log("Retrieving default profile config for general login.");
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, line_login_channel_id, line_login_channel_secret, display_name')
        .not('line_login_channel_id', 'is', null) // チャネルIDが設定されていることを確認
        .not('line_login_channel_secret', 'is', null) // チャネルシークレットが設定されていることを確認
        .limit(1); // 最初の1件を取得

      if (profileError || !profiles || profiles.length === 0) {
        console.error('No suitable profile found for general LINE login:', profileError);
        throw new Error("No default LINE login configuration found. Please configure LINE Login settings.");
      }
      profileCfg = profiles;
      inviteCodeUsed = null; // 一般ログインでは招待コードは使用しない
    }

    if (!profileCfg) { // 上記の分岐で取得できない場合のエラーハンドリング (通常は発生しないはず)
      throw new Error("LINE login configuration missing after state processing.");
    }

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
        client_id: profileCfg.line_login_channel_id, // 動的に取得したチャネルIDを使用 [7]
        client_secret: profileCfg.line_login_channel_secret, // 動的に取得したチャネルシークレットを使用 [7]
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

    // SECURITY: Validate and sanitize LINE profile data [8]
    if (!lineProfile.userId || !/^U[0-9a-fA-F]{32}$/.test(lineProfile.userId)) {
      console.log("Invalid LINE user ID format:", lineProfile.userId);
      throw new Error("Invalid LINE user ID format");
    }

    // Sanitize display name to prevent XSS [9]
    const sanitizedDisplayName = lineProfile.displayName ?
      lineProfile.displayName
        .replace(/<[^>]*>/g, '')
        .replace(/javascript:/gi, '')
        .replace(/data:/gi, '')
        .trim()
        .substring(0, 100) :
      null;

    /* ---------- line_friends upsert ---------- */
    // フローの種類に関わらずline_friendsテーブルを更新/挿入 [9]
    await supabase.from("line_friends").upsert({
      user_id: profileCfg.user_id, // 取得したプロファイルのuser_idを使用
      line_user_id: lineProfile.userId,
      display_name: sanitizedDisplayName,
      picture_url: lineProfile.pictureUrl ?? null,
    });
    console.log("line_friends upserted successfully.");

    /* ---------- シナリオ登録 & RPC (条件付き) ---------- */
    // ★ 修正点3: 招待コードが利用された場合のみシナリオ登録RPCを呼び出す [4]
    if (inviteCodeUsed) {
      console.log("Calling register_friend_to_scenario RPC with invite code.");
      const { data: reg, error: rpcError } = await supabase.rpc("register_friend_to_scenario", {
        p_line_user_id: lineProfile.userId,
        p_invite_code: inviteCodeUsed, // 実際の招待コードを渡す
        p_display_name: sanitizedDisplayName,
        p_picture_url: lineProfile.pictureUrl ?? null,
      });

      if (rpcError) {
        console.error("register_friend_to_scenario RPC error:", rpcError);
        throw new Error("Failed to register friend to scenario via RPC.");
      }
      if (!reg?.success) {
        console.error("register_friend_to_scenario failed:", reg?.error);
        throw new Error("register_friend_to_scenario failed");
      }
      console.log("Scenario registration RPC successful.");
    } else {
      console.log("Skipping scenario registration RPC for general login (no invite code).");
    }

    /* ---------- 完了画面へ ---------- */
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location:
          `https://74048ab5-8d5a-425a-ab29-bd5cc50dc2fe.lovableproject.com/?ok=1`,
      },
    });

  } catch (e: any) {
    console.error("callback error:", e);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
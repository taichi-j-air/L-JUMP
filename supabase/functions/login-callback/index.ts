// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  validateInviteCode, 
  sanitizeTextInput,
  rateLimiter,
  createSecureHeaders,
  createErrorResponse,
  validateRequiredParams
} from '../_shared/security.ts'

const corsHeaders = createSecureHeaders();

/* ────────────────────────────── */
/*  Main entry (Edge Function)    */
/* ────────────────────────────── */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting check
  const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const rateAllowed = await rateLimiter.isAllowed(`login:${clientIP}`, 10, 60000); // 10 requests per minute
  
  if (!rateAllowed) {
    console.warn('Rate limit exceeded for login callback, IP:', clientIP);
    return createErrorResponse('Rate limit exceeded', 429);
  }

  try {
    console.log("=== LOGIN CALLBACK START ===");

    /* ── 1. パラメータ取得 & バリデーション ── */
    const url = new URL(req.url);
    const code  = url.searchParams.get("code");
    const state = url.searchParams.get("state");   // ← 招待コードまたは"login"
    const err   = url.searchParams.get("error");

    console.log("Callback parameters:", { code: !!code, state, err });

    if (err) {
      const sanitizedError = sanitizeTextInput(err);
      throw new Error("LINE authentication error: " + sanitizedError);
    }
    
    validateRequiredParams({ code, state }, ['code', 'state']);
    
    // Parse state: supports raw invite code or Base64URL JSON
    let scenarioCode: string | null = null;
    let campaign: string | null = null;
    let source: string | null = null;

    if (state && state !== "login") {
      try {
        const b64 = state.replace(/-/g, '+').replace(/_/g, '/');
        const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
        const json = atob(b64 + pad);
        const obj = JSON.parse(json);
        if (obj?.scenario) {
          scenarioCode = String(obj.scenario);
          if (obj.campaign != null) campaign = String(obj.campaign);
          if (obj.source != null) source = String(obj.source);
        }
      } catch (_) {
        // ignore, fallback to raw state
      }
      if (!scenarioCode) scenarioCode = state;
      if (!validateInviteCode(scenarioCode)) {
        throw new Error("Invalid invite code format");
      }
    }

    /* ── 2. Supabase 初期化 ── */
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let profile: any;
    let isGeneralLogin = false;
    let scenarioUserId: string | null = null;

    /* ── 3. 一般ログインかシナリオ招待かを判定 ── */
    if (state === "login") {
      console.log("Processing general login test");
      // 一般ログインの場合は、認証済みユーザーのプロファイルを取得
      // TODO: 実際の実装では、認証されたユーザーのIDを使用する必要があります
      // 現在は最初のプロファイルを使用（テスト用）
      const { data: profiles, error: profileErr } = await supabase
        .from("profiles")
        .select("line_login_channel_id, line_login_channel_secret, display_name, user_id")
        .not("line_login_channel_id", "is", null)
        .not("line_login_channel_secret", "is", null)
        .limit(1);

      console.log("Profile query result:", { profiles, profileErr });

      if (profileErr || !profiles || profiles.length === 0) {
        throw new Error("No valid LINE login configuration found. Please configure LINE login settings first.");
      }
      profile = profiles[0];
      isGeneralLogin = true;
      console.log("Using profile for general login:", profile.display_name);
    } else {
      console.log("Processing scenario invite with code:", scenarioCode);
      // 招待コード由来の設定取得（曖昧な埋め込みを避けて二段クエリ＋フォールバック）
      const { data: invite, error: inviteErr } = await supabase
        .from("scenario_invite_codes")
        .select("user_id, scenario_id, is_active")
        .eq("invite_code", scenarioCode)
        .eq("is_active", true)
        .maybeSingle();

      if (inviteErr || !invite) {
        throw new Error("Invalid or inactive invite code " + scenarioCode);
      }

      // まずは invite.user_id でプロフィール検索
      let resolvedUserId: string | null = invite.user_id ?? null;

      let { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select(`
          line_login_channel_id,
          line_login_channel_secret,
          display_name,
          add_friend_url,
          line_bot_id,
          user_id
        `)
        .eq("user_id", resolvedUserId)
        .maybeSingle();

      // 見つからない場合は scenario_id → step_scenarios 経由で user_id を再解決
      if ((!prof || profErr) && invite.scenario_id) {
        const { data: scen, error: scenErr } = await supabase
          .from('step_scenarios')
          .select('user_id')
          .eq('id', invite.scenario_id)
          .maybeSingle();

        if (!scenErr && scen?.user_id) {
          resolvedUserId = scen.user_id;
          const r = await supabase
            .from("profiles")
            .select(`
              line_login_channel_id,
              line_login_channel_secret,
              display_name,
              add_friend_url,
              line_bot_id,
              user_id
            `)
            .eq("user_id", resolvedUserId)
            .maybeSingle();
          prof = r.data;
          profErr = r.error;
        }
      }

      if (profErr || !prof) {
        throw new Error("Profile not found for invite code " + scenarioCode);
      }

      scenarioUserId = resolvedUserId;
      profile = prof;
    }

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

    /* ── 7. 一般ログインの場合はプロフィール記録のみ ── */
    if (isGeneralLogin) {
      console.log("General login successful for user:", lineProfile.userId);
      
      /* ── 9. 完了ページへリダイレクト ── */
      const generalLoginSuccessUrl = `https://74048ab5-8d5a-425a-ab29-bd5cc50dc2fe.lovableproject.com/login-success?user_name=${encodeURIComponent(display)}`;
      return Response.redirect(generalLoginSuccessUrl, 302);
    }

    /* ── 8. シナリオ招待の場合：友達とシナリオ登録 ── */
    await supabase.from("line_friends").upsert({
      user_id: scenarioUserId,
      line_user_id: lineProfile.userId,
      display_name: display,
      picture_url : lineProfile.pictureUrl ?? null,
      campaign_id: campaign,
      registration_source: source ?? 'scenario_invite'
    });

    /* ── 9. シナリオ登録 RPC ── */
    const { data: reg, error: regErr } = await supabase.rpc(
      "register_friend_to_scenario",
      {
        p_line_user_id: lineProfile.userId,
        p_invite_code : scenarioCode,
        p_display_name: display,
        p_picture_url : lineProfile.pictureUrl ?? null,
      },
    );

    if (regErr || !reg?.success) {
      console.error("Scenario registration failed:", regErr, reg);
      throw new Error("register_friend_to_scenario failed: " + (regErr?.message || reg?.error || "Unknown error"));
    }

    console.log("Scenario registration successful:", reg);

    // Tag campaign/source to friend and tracking rows
    try {
      if (campaign || source) {
        await supabase
          .from('line_friends')
          .update({
            campaign_id: campaign,
            registration_source: source ?? 'scenario_invite',
            updated_at: new Date().toISOString()
          })
          .eq('id', reg.friend_id);

        await supabase
          .from('step_delivery_tracking')
          .update({
            campaign_id: campaign,
            registration_source: source ?? 'scenario_invite',
            updated_at: new Date().toISOString()
          })
          .eq('friend_id', reg.friend_id)
          .eq('scenario_id', reg.scenario_id);
      }
    } catch (tagErr) {
      console.warn('Failed to tag campaign/source:', tagErr);
    }

    // ── 10. ステップ1の配信スケジュールを設定（開始時間を厳密に反映） ──
    try {
      // 友だちの追加日時
      const { data: friendRow } = await supabase
        .from('line_friends')
        .select('id, added_at')
        .eq('id', reg.friend_id)
        .maybeSingle();

      // ステップ1取得
      const { data: firstStep } = await supabase
        .from('steps')
        .select('id, delivery_type, delivery_seconds, delivery_minutes, delivery_hours, delivery_days, specific_time, delivery_time_of_day')
        .eq('scenario_id', reg.scenario_id)
        .order('step_order', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (friendRow && firstStep) {
        const { data: scheduledAt } = await supabase.rpc('calculate_scheduled_delivery_time', {
          p_friend_added_at: friendRow.added_at,
          p_delivery_type: firstStep.delivery_type,
          p_delivery_seconds: firstStep.delivery_seconds || 0,
          p_delivery_minutes: firstStep.delivery_minutes || 0,
          p_delivery_hours: firstStep.delivery_hours || 0,
          p_delivery_days: firstStep.delivery_days || 0,
          p_specific_time: firstStep.specific_time || null,
          p_previous_step_delivered_at: null,
          p_delivery_time_of_day: firstStep.delivery_time_of_day || null
        });

        if (scheduledAt) {
          const sched = new Date(scheduledAt as unknown as string);
          const now = new Date();
          const status = sched <= now ? 'ready' : 'waiting';

          await supabase
            .from('step_delivery_tracking')
            .update({
              scheduled_delivery_at: sched.toISOString(),
              next_check_at: new Date(sched.getTime() - 5000).toISOString(),
              status
            })
            .eq('scenario_id', reg.scenario_id)
            .eq('friend_id', reg.friend_id)
            .eq('step_id', firstStep.id);
        }
      }
    } catch (schedErr) {
      console.warn('Failed to set first step schedule:', schedErr);
    }

    // ── 10. 即時ステップ配信をバックエンド側でトリガー（フロント依存を排除） ──
    try {
      await fetch('https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/scheduled-step-delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}` },
        body: JSON.stringify({ trigger: 'login_callback', scenario: scenarioCode, line_user_id: lineProfile.userId })
      });
    } catch (triggerErr) {
      console.warn('Failed to trigger scheduled-step-delivery:', triggerErr);
    }

    // ── 11. LINEアプリのトーク画面（または友だち追加）へ遷移 ──
    const chatUrl = (profile.add_friend_url && profile.add_friend_url.startsWith('https://'))
      ? profile.add_friend_url
      : (profile.line_bot_id
          ? `https://line.me/R/ti/p/${encodeURIComponent(profile.line_bot_id)}`
          : `https://74048ab5-8d5a-425a-ab29-bd5cc50dc2fe.lovableproject.com/login-success?user_name=${encodeURIComponent(display)}&scenario=${scenarioCode}`
        );

    return Response.redirect(chatUrl, 302);
  } catch (e: any) {
    console.error("callback error:", e);
    return new Response(
      JSON.stringify({ error: String(e.message ?? e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

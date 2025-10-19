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

const getFrontendBaseUrl = () => {
  const raw =
    Deno.env.get("APP_BASE_URL") ||
    Deno.env.get("PUBLIC_APP_URL") ||
    Deno.env.get("FRONTEND_BASE_URL") ||
    Deno.env.get("CLIENT_BASE_URL");
  if (raw && raw.trim().length > 0) {
    return raw.trim().replace(/\/+$/, "");
  }
  return "https://rtjxurmuaawyzjcdkqxt.supabase.co";
};

const FRONTEND_BASE_URL = getFrontendBaseUrl();

const sanitizeOrigin = (value: string | null | undefined): string | null => {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) return null;
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
};

const buildFrontendUrl = (path: string, origin?: string | null) => {
  const base = sanitizeOrigin(origin) || FRONTEND_BASE_URL;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
};

const tryDecodeState = (raw: string | null) => {
  if (!raw) return null;
  try {
    const normalized = raw.replace(/-/g, '+').replace(/_/g, '/');
    const pad = normalized.length % 4 ? '='.repeat(4 - (normalized.length % 4)) : '';
    const json = atob(normalized + pad);
    return JSON.parse(json);
  } catch {
    return null;
  }
};

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
    const retry = url.searchParams.get("retry");
    
    // Enhanced logging
    const userAgent = req.headers.get('user-agent') || '';
    const referer = req.headers.get('referer') || '';
    const isMobile = /iPhone|iPad|iPod|Android/i.test(userAgent);

    console.log("Callback parameters:", { 
      code: !!code, 
      state, 
      err,
      retry,
      userAgent: userAgent.substring(0, 100),
      referer,
      isMobile
    });

    if (err) {
      const sanitizedError = sanitizeTextInput(err);
      throw new Error("LINE authentication error: " + sanitizedError);
    }
    
    validateRequiredParams({ code, state }, ['code', 'state']);
    
    // Parse state: supports raw invite code or Base64URL JSON
    const decodedState = tryDecodeState(state);
    let scenarioCode: string | null = null;
    let campaign: string | null = null;
    let source: string | null = null;
    let loginOrigin = sanitizeOrigin(decodedState?.origin);
    const stateMode = typeof decodedState?.mode === "string" ? decodedState.mode : null;
    const stateUserId = typeof decodedState?.userId === "string" ? decodedState.userId : null;

    let isGeneralLogin = false;

    if (stateMode === "login") {
      isGeneralLogin = true;
    } else if (state === "login") {
      isGeneralLogin = true;
      if (!loginOrigin) {
        const referer = req.headers.get("origin") ?? req.headers.get("referer");
        loginOrigin = sanitizeOrigin(referer ?? null);
      }
    } else if (state) {
      if (decodedState && (decodedState.inviteCode || decodedState.scenario)) {
        scenarioCode = String(decodedState.inviteCode || decodedState.scenario);
        if (decodedState.campaign != null) campaign = String(decodedState.campaign);
        if (decodedState.source != null) source = String(decodedState.source);
      }

      if (!scenarioCode) scenarioCode = state;

      if (!validateInviteCode(scenarioCode)) {
        console.error('❌ Invalid invite code format:', scenarioCode);
        throw new Error("Invalid invite code format");
      }
      console.log('✅ Valid invite code:', scenarioCode);
    }

    /* ── 2. Supabase 初期化 ── */
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let profile: any;
    let scenarioUserId: string | null = null;

    /* ── 3. 一般ログインかシナリオ招待かを判定 ── */
    if (isGeneralLogin) {
      console.log("Processing general login test");

      if (stateUserId) {
        const { data: specificProfile, error: specificError } = await supabase
          .from("profiles")
          .select("line_login_channel_id, line_login_channel_secret, display_name, user_id")
          .eq("user_id", stateUserId)
          .maybeSingle();

        if (!specificError && specificProfile?.line_login_channel_id && specificProfile?.line_login_channel_secret) {
          profile = specificProfile;
          console.log("Using user-specific profile for general login:", profile.display_name);
        } else if (specificError) {
          console.warn("Failed to load user-specific profile for general login:", specificError.message);
        }
      }

      if (!profile) {
        const { data: profiles, error: profileErr } = await supabase
          .from("profiles")
          .select("line_login_channel_id, line_login_channel_secret, display_name, user_id")
          .not("line_login_channel_id", "is", null)
          .not("line_login_channel_secret", "is", null)
          .limit(1);

        console.log("Profile fallback query result:", { profiles, profileErr });

        if (profileErr || !profiles || profiles.length === 0) {
          throw new Error("No valid LINE login configuration found. Please configure LINE login settings first.");
        }
        profile = profiles[0];
      }

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

    console.log("📝 Token exchange request details:", {
      codeLength: code?.length || 0,
      codePrefix: code?.substring(0, 8) + '...',
      redirectUri,
      channelIdPrefix: profile.line_login_channel_id?.substring(0, 8) + '...',
      hasChannelSecret: !!profile.line_login_channel_secret,
      timestamp: new Date().toISOString()
    });

    const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code || '',
        redirect_uri: redirectUri,
        client_id: profile.line_login_channel_id,
        client_secret: profile.line_login_channel_secret,
      }),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      console.error("❌ Token exchange failed:", {
        status: tokenRes.status,
        statusText: tokenRes.statusText,
        error: text,
        redirectUri,
        channelIdPrefix: profile.line_login_channel_id?.substring(0, 8) + '...',
        requestTime: new Date().toISOString(),
        retry,
        userAgent: userAgent.substring(0, 100)
      });
      
      // Handle invalid_grant errors with automatic retry/fallback
      let errorObj: any = {};
      try {
        errorObj = JSON.parse(text);
      } catch {
        errorObj = { error: text };
      }
      
      if (errorObj.error === "invalid_grant") {
        console.log("🔄 Detected invalid_grant error (authorization code reuse)");
        
        // If not retried yet, redirect to scenario-login to get a new code
        if (!retry && scenarioCode) {
          console.log("⏪ Redirecting to scenario-login for retry...");
          const retryParams = new URLSearchParams({
            scenario: scenarioCode,
            retry: "1"
          });
          if (campaign) retryParams.set("campaign", campaign);
          if (source) retryParams.set("source", source);
          
          const retryUrl = `https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/scenario-login?${retryParams.toString()}`;
          return Response.redirect(retryUrl, 302);
        }
        
        // If already retried, fallback to LINE deep link/add friend
        console.log("⏭️ Retry failed, redirecting to LINE as fallback...");
        let fallbackUrl: string;
        
        if (isMobile && profile.line_bot_id) {
          fallbackUrl = `line://ti/p/${encodeURIComponent(profile.line_bot_id)}`;
        } else if (profile.add_friend_url && profile.add_friend_url.startsWith('https://')) {
          fallbackUrl = profile.add_friend_url;
        } else if (profile.line_bot_id) {
          fallbackUrl = `https://line.me/R/ti/p/${encodeURIComponent(profile.line_bot_id)}`;
        } else {
          fallbackUrl = buildFrontendUrl('/login-success?error=invalid_grant', loginOrigin);
        }
        
        console.log("Fallback redirect URL:", fallbackUrl);
        return Response.redirect(fallbackUrl, 302);
      }
      
      throw new Error("Token exchange failed: " + text.slice(0, 120));
    }
    
    console.log("✅ Token exchange successful");
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
      const generalLoginSuccessUrl = buildFrontendUrl(`/login-success?user_name=${encodeURIComponent(display)}`, loginOrigin);
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
        p_registration_source: 'invite_link',
        p_scenario_id: null,
      },
    );

    // 既に登録済みの場合の処理（エラーではなく正常な既存友だちとして扱う）
    if (!regErr && reg?.already_registered === true) {
      console.log("✅ User already registered to scenario (existing friend):", {
        friend_id: reg.friend_id,
        scenario_id: reg.scenario_id,
        line_user_id: lineProfile.userId
      });
      
      // 既存友だちの即時配信トリガーを実行
      try {
        const deliveryPayload = {
          trigger: 'login_callback_existing',
          scenario_code: scenarioCode,
          line_user_id: lineProfile.userId,
          friend_id: reg.friend_id,
          scenario_id: reg.scenario_id,
          is_existing_friend: true,
          timestamp: new Date().toISOString()
        };

        console.log("Triggering step delivery for existing friend:", deliveryPayload);

        await fetch('https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/scheduled-step-delivery', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}` 
          },
          body: JSON.stringify(deliveryPayload)
        });
      } catch (triggerErr) {
        console.warn('Failed to trigger delivery for existing friend:', triggerErr);
      }
      
      // LINEトーク画面へリダイレクト（ディープリンク優先）
      let redirectUrl: string;
      if (isMobile && profile.line_bot_id) {
        redirectUrl = `line://ti/p/${encodeURIComponent(profile.line_bot_id)}`;
      } else if (profile.add_friend_url && profile.add_friend_url.startsWith('https://')) {
        redirectUrl = profile.add_friend_url;
      } else if (profile.line_bot_id) {
        redirectUrl = `https://line.me/R/ti/p/${encodeURIComponent(profile.line_bot_id)}`;
      } else {
        redirectUrl = buildFrontendUrl(`/login-success?user_name=${encodeURIComponent(display)}&scenario=${scenarioCode}&already_registered=true`);
      }
      
      console.log("Redirecting existing friend to:", redirectUrl);
      return Response.redirect(redirectUrl, 302);
    }

    if (regErr || !reg?.success) {
      console.error("Scenario registration failed:", regErr, reg);
      throw new Error("register_friend_to_scenario failed: " + (regErr?.message || reg?.error || "Unknown error"));
    }

    console.log("✅ Scenario registration successful:", {
      friend_id: reg.friend_id,
      scenario_id: reg.scenario_id,
      re_registration_allowed: reg.re_registration_allowed,
      is_re_registration: !!reg.re_registration_allowed
    });

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

    // ── 10. 最初のステップ（step_order = 0）の配信スケジュールを設定 ──
    try {
      // step_order = 0 の最初のステップを取得
      const { data: firstStep } = await supabase
        .from('steps')
        .select('id, step_order, delivery_type, delivery_seconds, delivery_minutes, delivery_hours, delivery_days, specific_time, delivery_time_of_day, delivery_relative_to_previous')
        .eq('scenario_id', reg.scenario_id)
        .eq('step_order', 0)
        .maybeSingle();

      if (firstStep) {
        console.log("📋 First step found:", {
          step_id: firstStep.id,
          step_order: firstStep.step_order,
          delivery_type: firstStep.delivery_type
        });

        // 配信種別をRPCに合わせて正規化
        let effectiveType = firstStep.delivery_type as string;
        if (effectiveType === 'immediate') effectiveType = 'immediately';
        if (effectiveType === 'specific') effectiveType = 'specific_time';
        if (effectiveType === 'time_of_day') effectiveType = 'relative_to_previous';
        if (effectiveType === 'relative' && (firstStep as any).delivery_relative_to_previous) effectiveType = 'relative_to_previous';

        // 基準は「シナリオ登録時刻」（= 今）
        const registrationAt = new Date();

        const { data: scheduledAt } = await supabase.rpc('calculate_scheduled_delivery_time', {
          p_friend_added_at: registrationAt.toISOString(),
          p_delivery_type: effectiveType,
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
          
          // 即時配信の判定を改善：delivery_typeがimmediatelyまたは0秒相対配信の場合
          const isImmediate = effectiveType === 'immediately' || 
                             (effectiveType === 'relative' && 
                              firstStep.delivery_seconds === 0 &&
                              firstStep.delivery_minutes === 0 &&
                              firstStep.delivery_hours === 0 &&
                              firstStep.delivery_days === 0);
          
          // 即時配信、またはスケジュール時刻が2秒以内の場合はreadyに
          const initialStatus = isImmediate || sched <= new Date(now.getTime() + 2000) ? 'ready' : 'waiting';
          
          console.log("⏰ Setting step schedule:", {
            scheduled_at: sched.toISOString(),
            status: initialStatus,
            is_immediate: effectiveType === 'immediately'
          });

          await supabase
            .from('step_delivery_tracking')
            .update({
              scheduled_delivery_at: sched.toISOString(),
              next_check_at: new Date(sched.getTime() - 5000).toISOString(),
              status: initialStatus
            })
            .eq('scenario_id', reg.scenario_id)
            .eq('friend_id', reg.friend_id)
            .eq('step_id', firstStep.id);
        }
      } else {
        console.warn("⚠️ No step with step_order = 0 found for scenario:", reg.scenario_id);
      }
    } catch (schedErr) {
      console.warn('Failed to set first step schedule:', schedErr);
    }

    // ── 11. 友だち登録状況を確認 ── 
    const { data: existingFriend } = await supabase
      .from("line_friends")
      .select("id, user_id")
      .eq("line_user_id", lineProfile.userId)
      .eq("user_id", scenarioUserId)
      .maybeSingle();

    // ── 12. 即時ステップ配信の改善版トリガー ──
    try {
      const deliveryPayload = {
        trigger: 'login_callback',
        scenario_code: scenarioCode,
        line_user_id: lineProfile.userId,
        friend_id: reg.friend_id,
        scenario_id: reg.scenario_id,
        is_existing_friend: !!existingFriend,
        timestamp: new Date().toISOString()
      };

      console.log("Triggering step delivery with payload:", deliveryPayload);

      await fetch('https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/scheduled-step-delivery', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}` 
        },
        body: JSON.stringify(deliveryPayload)
      });
    } catch (triggerErr) {
      console.warn('Failed to trigger scheduled-step-delivery:', triggerErr);
    }

    // ── 13. 友だち状態に応じたリダイレクト先決定 ── 
    let redirectUrl: string;

    if (existingFriend) {
      // 既存の友だち = 既にフォロー済み
      // LINEトーク画面を開く（ディープリンク優先）
      if (isMobile && profile.line_bot_id) {
        // モバイルはディープリンクでLINEアプリを直接開く
        redirectUrl = `line://ti/p/${encodeURIComponent(profile.line_bot_id)}`;
      } else if (profile.add_friend_url && profile.add_friend_url.startsWith('https://')) {
        // デスクトップまたはフォールバック
        redirectUrl = profile.add_friend_url;
      } else if (profile.line_bot_id) {
        redirectUrl = `https://line.me/R/ti/p/${encodeURIComponent(profile.line_bot_id)}`;
      } else {
        // 最終フォールバック
        redirectUrl = buildFrontendUrl(`/login-success?user_name=${encodeURIComponent(display)}&scenario=${scenarioCode}&message=already_friend`);
      }
    } else {
      // 新規友だち = 友だち追加が必要
      redirectUrl = profile.add_friend_url && profile.add_friend_url.startsWith('https://')
        ? profile.add_friend_url
        : `https://line.me/R/ti/p/${encodeURIComponent(profile.line_bot_id || '')}`;
    }

    console.log("Final redirect URL:", redirectUrl);
    return Response.redirect(redirectUrl, 302);

  } catch (e: any) {
    console.error("callback error:", e);
    return new Response(
      JSON.stringify({ error: String(e.message ?? e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

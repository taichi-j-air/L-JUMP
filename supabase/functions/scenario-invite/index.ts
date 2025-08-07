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

  // DB 取得
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  
  // LINE Login設定を含む検証
  const { data, error } = await db
    .from("scenario_invite_codes")
    .select(`
      scenario_id,
      max_usage,
      usage_count,
      step_scenarios!inner (
        user_id,
        name,
        profiles!inner (
          line_login_channel_id,
          line_login_channel_secret,
          line_api_status,
          display_name
        )
      )
    `)
    .eq("invite_code", inviteCode)
    .eq("is_active", true)
    .single();

  if (error || !data) {
    console.warn("Invalid invite code:", inviteCode);
    return new Response("Invalid invite code", { status: 404, headers: cors });
  }

  const profile = data.step_scenarios.profiles;

  // LINE Login設定の確認
  if (!profile.line_login_channel_id || !profile.line_login_channel_secret) {
    console.error("Missing LINE Login config for invite:", inviteCode);
    return new Response("LINE Login not configured", { status: 500, headers: cors });
  }

  // 使用制限チェック
  if (data.max_usage && data.usage_count >= data.max_usage) {
    console.warn("Usage limit exceeded for invite:", inviteCode);
    return new Response("Usage limit exceeded", { status: 410, headers: cors });
  }

  if (profile.line_api_status !== 'active') {
    console.warn("LINE API not active for invite:", inviteCode);
    return new Response("Service not available", { status: 503, headers: cors });
  }

  // 使用カウント更新（招待コードアクセス時）
  await db
    .from("scenario_invite_codes")
    .update({ usage_count: data.usage_count + 1 })
    .eq("invite_code", inviteCode);

  // ✅ 修正：全デバイスでフロントエンドの招待ページにリダイレクト
  // これによりLINE Login認証フローが確実に実行される
  const fe = "https://74048ab5-8d5a-425a-ab29-bd5cc50dc2fe.lovableproject.com";
  const redirectUrl = `${fe}/invite/${encodeURIComponent(inviteCode)}`;
  
  console.log("Redirect to invite page:", redirectUrl);
  return new Response(null, {
    status: 302,
    headers: { ...cors, Location: redirectUrl },
  });
});

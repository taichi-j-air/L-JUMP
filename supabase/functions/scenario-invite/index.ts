// supabase/functions/scenario-invite/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const url = new URL(req.url);
  const inviteCode = url.searchParams.get("code");
  if (!inviteCode) {
    // 招待コード未指定時：何も返さない
    return new Response(null, { status: 204, headers: cors });
  }

  // DB初期化
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // シナリオ/プロファイル取得
  const { data, error } = await db
    .from("scenario_invite_codes")
    .select(`
      id,
      scenario_id,
      invite_code,
      step_scenarios!inner (
        profiles!inner (
          user_id,
          line_bot_id
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
  const botId = profile.line_bot_id;

  if (!botId) {
    return new Response("LINE Bot設定が不完全です", { status: 500, headers: cors });
  }

  // LINE友だち追加URLを構成
  const id = botId.startsWith("@") ? botId : `@${botId}`;
  let lineUrl = `https://line.me/R/ti/p/${id}`;

  // 招待コードをstateパラメータとして付与
  const separator = lineUrl.includes("?") ? "&" : "?";
  lineUrl += `${separator}state=${encodeURIComponent(inviteCode)}`;

  // 招待クリックをログに記録
  await db.from("invite_clicks").insert({
    invite_code: inviteCode,
    ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
    user_agent: req.headers.get("user-agent") || "unknown",
    referer: req.headers.get("referer") || null
  }).catch(console.error);

  // LINE友だち追加URLにリダイレクト
  return new Response(null, {
    status: 302,
    headers: { ...cors, Location: lineUrl },
  });
});

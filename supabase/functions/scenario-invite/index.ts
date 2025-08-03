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
  const { data, error } = await db
    .from("scenario_invite_codes")
    .select(`
      scenario_id,
      step_scenarios!inner (
        profiles!inner (
          line_login_channel_id,
          liff_id
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

  const { liff_id: liffId, line_login_channel_id: channelId } =
    data.step_scenarios.profiles!;

  if (!liffId || !channelId) {
    console.error("Missing LIFF config for invite:", inviteCode);
    return new Response("LIFF not configured", { status: 500, headers: cors });
  }

  // UA 判定
  const ua = req.headers.get("user-agent") || "";
  const isMobile = /mobile|android|iphone|ipad|ipod/i.test(ua);

  if (isMobile) {
    // モバイルなら LIFF を直叩き
    const liffUrl =
      `https://liff.line.me/${liffId}` +
      `?inviteCode=${inviteCode}` +
      `&scenarioId=${data.scenario_id}`;
    console.log("Redirect to LIFF:", liffUrl);
    return new Response(null, {
      status: 302,
      headers: { ...cors, Location: liffUrl },
    });
  } else {
    // PCならSPAのQRページへリダイレクト
    const fe = "https://74048ab5-8d5a-425a-ab29-bd5cc50dc2fe.lovableproject.com";
    const url = `${fe}/invite/${inviteCode}`;
    console.log("Redirect to PC invite page:", url);
    return new Response(null, {
      status: 302,
      headers: { ...cors, Location: url },
    });
  }
});

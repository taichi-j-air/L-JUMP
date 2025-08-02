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
    /* ---------- ① パラメータ取得 ---------- */
    const url = new URL(req.url);
    const inviteCode =
      url.searchParams.get("code") ??
      url.pathname.split("/").filter(Boolean).pop();

    if (!inviteCode) {
      return new Response(
        JSON.stringify({ error: "Invite code not found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    /* ---------- ② DB 接続 ---------- */
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const frontendOrigin = "https://74048ab5-8d5a-425a-ab29-bd5cc50dc2fe.lovableproject.com";

    const supabase = createClient(supabaseUrl, serviceKey);

    /* ---------- ③ 招待コード検証 & LIFF ID取得 ---------- */
    const { data: inviteData, error: inviteError } = await supabase
      .from("scenario_invite_codes")
      .select(`
        *,
        step_scenarios!inner (
          user_id,
          profiles!inner (
            liff_id
          )
        )
      `)
      .eq("invite_code", inviteCode)
      .eq("is_active", true)
      .single();

    if (inviteError || !inviteData) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired invite code" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const liffId = inviteData.step_scenarios?.profiles?.liff_id;
    if (!liffId) {
      return new Response(
        JSON.stringify({ error: "LIFF ID not configured" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    /* ---------- ④ UA 判定 & ログ ---------- */
    const ua = req.headers.get("user-agent") ?? "";
    const isMobile = /mobile|android|iphone|ipad|ipod/i.test(ua);

    try {
      await supabase.from("invite_clicks").insert({
        invite_code: inviteCode,
        ip: req.headers.get("x-forwarded-for") ?? "unknown",
        user_agent: ua,
        device_type: isMobile ? "mobile" : "desktop",
      });
    } catch (error) {
      console.log("Click log error (continuing):", error);
    }

    /* ---------- ⑤ リダイレクト URL ---------- */
    const redirectUrl = isMobile
      ? `${frontendOrigin}/liff-handler?code=${inviteCode}&liffId=${liffId}` // LiffHandlerページに必要な情報を渡す
      : `${frontendOrigin}/invite/${inviteCode}`;           // PC は QR ページ

    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: redirectUrl },
    });
  } catch (e) {
    console.error("scenario-invite error:", e);
    return new Response(
      JSON.stringify({ error: "Server error", details: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
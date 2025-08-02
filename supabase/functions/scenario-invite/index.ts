import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    console.log("=== scenario-invite START ===");
    console.log("Request URL:", req.url);
    console.log("User-Agent:", req.headers.get("user-agent"));

    const inviteCode =
      new URL(req.url).searchParams.get("code") ??
      req.url.split("/").filter(Boolean).pop();
      
    console.log("Extracted invite code:", inviteCode);
    if (!inviteCode) return jsonErr(400, "invite code required");

    /* DB チェック & LIFF ID取得 */
    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    console.log("Querying database for invite code:", inviteCode);
    const { data, error } = await db.from("scenario_invite_codes")
      .select(`
        id,
        step_scenarios!inner (
          profiles!inner (
            liff_id
          )
        )
      `)
      .eq("invite_code", inviteCode)
      .eq("is_active", true)
      .single();
    
    console.log("Database query result:", { data, error });
    
    if (!data) {
      console.log("No data found for invite code:", inviteCode);
      return jsonErr(404, "invalid / expired invite code");
    }
    
    const liffId = data.step_scenarios?.profiles?.liff_id;
    console.log("Extracted LIFF ID:", liffId);
    
    if (!liffId) {
      console.log("LIFF ID not found in profile");
      return jsonErr(500, "LIFF ID not configured");
    }

    /* UA で分岐 */
    const isMobile = /mobile|android|iphone|ipad|ipod/i.test(
      req.headers.get("user-agent") ?? "",
    );
    const fe = "https://74048ab5-8d5a-425a-ab29-bd5cc50dc2fe.lovableproject.com";

    const redirect = isMobile
      ? `https://liff.line.me/${liffId}?code=${inviteCode}` // LINEアプリを開く
      : `${fe}/invite/${inviteCode}`;                       // PC QR

    console.log("Redirecting to:", redirect);
    console.log("Is mobile:", isMobile);

    return new Response(null, { status: 302, headers: { ...cors, Location: redirect } });
  } catch (error) {
    console.error("=== scenario-invite ERROR ===");
    console.error("Error:", error);
    return jsonErr(500, `Server error: ${error.message}`);
  }
});

function jsonErr(code: number, msg: string) {
  return new Response(JSON.stringify({ error: msg }), {
    status: code,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
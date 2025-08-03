import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  // 1) CORS preflight
  if (req.method === "OPTIONS") return new Response(null, { headers: cors })

  // 2) パラメータなしアクセス (LIFF プリフェッチ) は静的ページを返す
  const url = new URL(req.url)
  const inviteCode = url.searchParams.get("code")
  if (!inviteCode) {
    // public/index.html はあなたの React ビルドのルート
    const html = await Deno.readTextFile("public/index.html")
    return new Response(html, {
      status: 200,
      headers: { ...cors, "Content-Type": "text/html" },
    })
  }

  try {
    console.log("=== scenario-invite START ===")
    console.log("Invite code:", inviteCode)

    // 3) DB からシナリオ＆LIFF設定を取得
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    )
    const { data, error } = await supabase
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
      .single()

    if (error || !data) {
      console.warn("Invalid or expired invite code:", inviteCode)
      return new Response("Invalid invite code", { status: 404, headers: cors })
    }

    const { liff_id: liffId, line_login_channel_id: channelId } =
      data.step_scenarios.profiles!

    if (!liffId || !channelId) {
      console.error("LIFF configuration missing for invite code:", inviteCode)
      return new Response("LIFF not configured", { status: 500, headers: cors })
    }

    // 4) UA でモバイル判定
    const ua = req.headers.get("user-agent") || ""
    const isMobile = /mobile|android|iphone|ipad|ipod/i.test(ua)

    // 5) モバイル → LIFF URL にリダイレクト
    if (isMobile) {
      const liffUrl =
        `https://liff.line.me/${liffId}` +
        `?inviteCode=${inviteCode}` +
        `&scenarioId=${data.scenario_id}`

      console.log("Redirect to LIFF:", liffUrl)
      return new Response(null, {
        status: 302,
        headers: { ...cors, Location: liffUrl },
      })
    }

    // 6) PC → 管理画面のQR表示ルートに返す (React Router で /invite/:code を表示)
    console.log("PC browser, serving invite page")
    const html = await Deno.readTextFile("public/index.html")
    return new Response(html, {
      status: 200,
      headers: { ...cors, "Content-Type": "text/html" },
    })

  } catch (e: any) {
    console.error("scenario-invite ERROR:", e)
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    })
  }
})

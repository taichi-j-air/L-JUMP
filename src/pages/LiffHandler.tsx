import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    liff: any;
  }
}

export default function LiffHandler() {
  const code = new URLSearchParams(location.search).get("code");
  const [channelId, setChannelId] = useState<string>("");

  useEffect(() => {
    (async () => {
      if (!code) return;

      try {
        // Channel IDを取得
        const { data } = await supabase
          .from("scenario_invite_codes")
          .select(`
            step_scenarios!inner (
              profiles!inner (
                line_login_channel_id,
                liff_id
              )
            )
          `)
          .eq("invite_code", code)
          .eq("is_active", true)
          .single();

        const liffId = data?.step_scenarios?.profiles?.liff_id;
        const fetchedChannelId = data?.step_scenarios?.profiles?.line_login_channel_id;
        
        if (!liffId || !fetchedChannelId) return;
        setChannelId(fetchedChannelId);

        // LIFF SDK ロード
        if (!window.liff) {
          await new Promise((ok) => {
            const s = document.createElement("script");
            s.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
            s.onload = ok;
            document.head.appendChild(s);
          });
        }

        await window.liff.init({ liffId });

        // LIFF内でLINEログイン認証（友だち追加オプション付き）を実行
        const redirectUri = "https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/login-callback";
        const scope = "profile%20openid";
        const state = code;
        const botPrompt = "normal"; // 友だち追加オプション表示

        const authUrl = `https://access.line.me/oauth2/v2.1/authorize?` +
          `response_type=code&` +
          `client_id=${fetchedChannelId}&` +
          `redirect_uri=${encodeURIComponent(redirectUri)}&` +
          `state=${state}&` +
          `scope=${scope}&` +
          `bot_prompt=${botPrompt}`;

        // LINEログイン認証画面にリダイレクト
        window.location.href = authUrl;
      } catch (error) {
        console.error("LIFF Handler Error:", error);
      }
    })();
  }, []);

  return (
    <div style={{ display: "grid", placeItems: "center", height: "100vh" }}>
      <div className="animate-spin h-10 w-10 border-b-2 border-green-500 rounded-full" />
    </div>
  );
}
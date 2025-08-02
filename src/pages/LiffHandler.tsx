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
      console.log("=== LiffHandler START ===");
      console.log("Current URL:", window.location.href);
      console.log("Code from URL:", code);
      
      if (!code) {
        console.error("No code parameter found");
        return;
      }

      try {
        console.log("Fetching channel info from database...");
        
        // Channel IDを取得
        const { data, error } = await supabase
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

        console.log("Database query result:", { data, error });

        const liffId = data?.step_scenarios?.profiles?.liff_id;
        const fetchedChannelId = data?.step_scenarios?.profiles?.line_login_channel_id;
        
        console.log("Extracted IDs:", { liffId, fetchedChannelId });
        
        if (!liffId || !fetchedChannelId) {
          console.error("Missing LIFF ID or Channel ID");
          return;
        }
        setChannelId(fetchedChannelId);

        console.log("Loading LIFF SDK...");
        
        // LIFF SDK ロード
        if (!window.liff) {
          await new Promise((ok) => {
            const s = document.createElement("script");
            s.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
            s.onload = ok;
            document.head.appendChild(s);
          });
        }

        console.log("Initializing LIFF...");
        await window.liff.init({ liffId });
        console.log("LIFF initialized successfully");

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

        console.log("Redirecting to LINE auth:", authUrl);
        
        // LINEログイン認証画面にリダイレクト
        window.location.href = authUrl;
      } catch (error) {
        console.error("=== LIFF Handler ERROR ===");
        console.error("Error:", error);
      }
    })();
  }, [code]);

  return (
    <div style={{ display: "grid", placeItems: "center", height: "100vh" }}>
      <div className="animate-spin h-10 w-10 border-b-2 border-green-500 rounded-full" />
    </div>
  );
}
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    liff: any;
  }
}

export default function LiffHandler() {
  const [liffId, setLiffId] = useState<string>("");
  
  useEffect(() => {
    (async () => {
      const code = new URLSearchParams(window.location.search).get("code");
      if (!code) return;

      // データベースからLIFF IDを取得
      const { data } = await supabase
        .from("scenario_invite_codes")
        .select(`
          step_scenarios!inner (
            profiles!inner (
              liff_id
            )
          )
        `)
        .eq("invite_code", code)
        .eq("is_active", true)
        .single();
      
      const fetchedLiffId = data?.step_scenarios?.profiles?.liff_id;
      if (!fetchedLiffId) return;
      
      setLiffId(fetchedLiffId);

      // SDK 動的ロード
      if (!window.liff) {
        await new Promise((res) => {
          const s = document.createElement("script");
          s.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
          s.onload = res;
          document.head.appendChild(s);
        });
      }

      await window.liff.init({ liffId: fetchedLiffId });

      if (!window.liff.isLoggedIn()) {
        window.liff.login({
          redirectUri:
            "https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/login-callback",
          state: code,
        });
      } else {
        window.location.href =
          `https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/login-callback?state=${code}`;
      }
    })();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500" />
    </div>
  );
}
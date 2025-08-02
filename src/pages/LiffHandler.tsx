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
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get("code");
      const liffIdParam = urlParams.get("liffId");
      
      console.log("LiffHandler params:", { code, liffIdParam });
      
      if (!code || !liffIdParam) {
        console.error("Missing required parameters");
        return;
      }
      
      setLiffId(liffIdParam);

      try {
        // SDK 動的ロード
        if (!window.liff) {
          await new Promise((res) => {
            const s = document.createElement("script");
            s.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
            s.onload = res;
            document.head.appendChild(s);
          });
        }

        console.log("Initializing LIFF with ID:", liffIdParam);
        await window.liff.init({ liffId: liffIdParam });

        if (!window.liff.isLoggedIn()) {
          console.log("User not logged in, redirecting to login");
          window.liff.login({
            redirectUri:
              "https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/login-callback",
            state: code,
          });
        } else {
          console.log("User already logged in, redirecting to callback");
          window.location.href =
            `https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/login-callback?state=${code}`;
        }
      } catch (error) {
        console.error("LIFF initialization error:", error);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4" />
        <p className="text-gray-600">LINE認証中...</p>
        {liffId && <p className="text-xs text-gray-400 mt-2">LIFF ID: {liffId}</p>}
      </div>
    </div>
  );
}
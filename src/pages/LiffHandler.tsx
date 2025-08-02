import { useEffect } from "react";

declare global {
  interface Window {
    liff: any;
  }
}

export default function LiffHandler() {
  useEffect(() => {
    (async () => {
      const liffId = import.meta.env.VITE_LIFF_ID;
      const code = new URLSearchParams(window.location.search).get("code");

      if (!liffId || !code) return;

      // SDK 動的ロード
      if (!window.liff) {
        await new Promise((res) => {
          const s = document.createElement("script");
          s.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
          s.onload = res;
          document.head.appendChild(s);
        });
      }

      await window.liff.init({ liffId });

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
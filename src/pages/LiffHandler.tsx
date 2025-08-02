import { useEffect } from "react";

declare global {
  interface Window {
    liff: any;
  }
}

export default function LiffHandler() {
  const liffId = import.meta.env.VITE_LIFF_ID;
  const code = new URLSearchParams(location.search).get("code");

  useEffect(() => {
    (async () => {
      if (!liffId || !code) return;

      // SDK ロード
      if (!window.liff) {
        await new Promise((ok) => {
          const s = document.createElement("script");
          s.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
          s.onload = ok;
          document.head.appendChild(s);
        });
      }

      await window.liff.init({ liffId });

      if (!window.liff.isLoggedIn()) {
        window.liff.login({
          redirectUri:
            "https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/login-callback",
          state: code,          // ← inviteCode をそのまま
        });
      } else {
        location.href =
          `https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/login-callback?state=${code}`;
      }
    })();
  }, []);

  return (
    <div style={{ display: "grid", placeItems: "center", height: "100vh" }}>
      <div className="animate-spin h-10 w-10 border-b-2 border-green-500 rounded-full" />
    </div>
  );
}
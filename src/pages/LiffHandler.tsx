import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    liff: any;
  }
}

export default function LiffHandler() {
  const [liffId, setLiffId] = useState<string>("");
  const [errorInfo, setErrorInfo] = useState<any>(null);
  
  useEffect(() => {
    (async () => {
      try {
        console.log("=== LiffHandler START ===");
        console.log("Current URL:", window.location.href);
        console.log("User Agent:", navigator.userAgent);
        
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get("code");
        const liffIdParam = urlParams.get("liffId");
        
        console.log("URL Parameters:", { code, liffIdParam });
        
        if (!code || !liffIdParam) {
          console.error("Missing required parameters");
          console.error("Available params:", Object.fromEntries(urlParams.entries()));
          return;
        }
        
        setLiffId(liffIdParam);

        console.log("Checking if LIFF SDK is loaded...");
        
        // SDK 動的ロード
        if (!window.liff) {
          console.log("Loading LIFF SDK...");
          await new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
            script.onload = () => {
              console.log("LIFF SDK loaded successfully");
              resolve(true);
            };
            script.onerror = (error) => {
              console.error("Failed to load LIFF SDK:", error);
              reject(error);
            };
            document.head.appendChild(script);
          });
        } else {
          console.log("LIFF SDK already loaded");
        }

        console.log("Initializing LIFF with ID:", liffIdParam);
        await window.liff.init({ liffId: liffIdParam });
        console.log("LIFF initialized successfully");

        console.log("Checking login status...");
        const isLoggedIn = window.liff.isLoggedIn();
        console.log("Is logged in:", isLoggedIn);

        if (!isLoggedIn) {
          console.log("User not logged in, redirecting to login");
          window.liff.login({
            redirectUri: "https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/login-callback",
            state: code,
          });
        } else {
          console.log("User already logged in, redirecting to callback");
          window.location.href = `https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/login-callback?state=${code}`;
        }
      } catch (error) {
        console.error("=== LIFF ERROR ===");
        console.error("Error type:", error.constructor.name);
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
        console.error("Full error object:", error);
        
        // エラー情報を画面にも表示
        setErrorInfo({
          type: error.constructor.name,
          message: error.message,
          stack: error.stack
        });
      }
    })();
  }, []);

  if (errorInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-red-800 font-bold mb-4">LIFF エラー</h2>
          <div className="text-sm text-red-700 space-y-2">
            <p><strong>タイプ:</strong> {errorInfo.type}</p>
            <p><strong>メッセージ:</strong> {errorInfo.message}</p>
            {errorInfo.stack && (
              <details className="mt-2">
                <summary className="cursor-pointer">詳細</summary>
                <pre className="text-xs mt-2 bg-red-100 p-2 rounded overflow-auto">
                  {errorInfo.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      </div>
    );
  }

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
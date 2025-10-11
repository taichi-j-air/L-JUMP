import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const LIFF_SDK_URL = "https://static.line-scdn.net/liff/edge/2/sdk.js";

const loadLiffSdk = (): Promise<void> => {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Window is undefined"));
  }

  if (window.liff) return Promise.resolve();

  const existing = document.getElementById("liff-sdk-script") as HTMLScriptElement | null;
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load LIFF SDK")), { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = "liff-sdk-script";
    script.src = LIFF_SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load LIFF SDK"));
    document.head.appendChild(script);
  });
};

const decodeParam = (value: string | null): string | null => {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch (_) {
    return value;
  }
};

const buildStatus = (message: string, description?: string) => ({ message, description });

export default function LiffAuth() {
  const [status, setStatus] = useState(buildStatus("準備中..."));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        console.log("=== LIFF Auth Debug Start ===");
        
        if (typeof window === "undefined") {
          throw new Error("このページはブラウザで実行する必要があります");
        }

        const search = new URLSearchParams(window.location.search);
        const ownerUserId = search.get("userId")?.trim();
        const rawTarget = decodeParam(search.get("target"));
        const fallbackUrl = decodeParam(search.get("fallback"));
        const liffId = search.get("liffId")?.trim() || search.get("liff_id")?.trim();

        console.log("1. パラメータ:", { ownerUserId, rawTarget, liffId, fallbackUrl });

        if (!ownerUserId) throw new Error("userIdパラメータがありません");
        if (!rawTarget) throw new Error("targetパラメータがありません");
        if (!liffId) throw new Error("liffIdパラメータがありません");

        setStatus(buildStatus("LIFFを読み込んでいます..."));
        await loadLiffSdk();
        console.log("2. LIFF SDK読み込み完了:", !!window.liff);

        if (!window.liff) throw new Error("LIFF SDKが利用できません");

        setStatus(buildStatus("LIFFを初期化中..."));
        await window.liff.init({ liffId });
        console.log("3. LIFF初期化完了");

        if (!window.liff.isLoggedIn()) {
          setStatus(buildStatus("LINEログインに移動中..."));
          console.log("4. LINEログインにリダイレクト");
          window.liff.login({ redirectUri: window.location.href });
          return;
        }

        setStatus(buildStatus("プロフィールを取得中..."));
        const context = window.liff.getContext ? window.liff.getContext() : null;
        const profile = await window.liff.getProfile();
        const lineUserId: string | undefined = context?.userId || profile?.userId;
        console.log("4. LINE ユーザーID取得:", lineUserId ? "成功" : "失敗");

        if (!lineUserId) {
          throw new Error("LINE ユーザーIDを取得できませんでした");
        }

        setStatus(buildStatus("移動先を準備中..."));
        console.log("5. Edge Function呼び出し開始");

        // タイムアウト処理を追加
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("タイムアウト: サーバーからの応答がありません（30秒）")), 30000);
        });

        const invokePromise = supabase.functions.invoke("liff-rich-menu-redirect", {
          body: {
            ownerUserId,
            lineUserId,
            target: rawTarget,
          },
        });

        const { data, error: fnError } = await Promise.race([invokePromise, timeoutPromise]) as any;

        console.log("6. Edge Function応答:", { success: data?.success, hasUrl: !!data?.url, error: fnError });

        if (fnError) {
          console.error("liff-rich-menu-redirect エラー", fnError);
          throw new Error(fnError.message ?? "リダイレクト先URLの解決に失敗しました");
        }

        if (!data?.success || !data.url) {
          const errorMsg = data?.error ?? "リダイレクト先URLの解決に失敗しました";
          console.error("Edge Function失敗:", errorMsg);
          
          // フォールバック: 元のtargetに直接移動（[UID]を除去）
          const cleanTarget = rawTarget.replace(/\[UID\]/g, "");
          if (cleanTarget && cleanTarget.startsWith("http")) {
            console.log("フォールバック: 元のURLに直接移動", cleanTarget);
            window.location.replace(cleanTarget);
            return;
          }
          
          throw new Error(errorMsg);
        }

        const destination: string = data.url;
        const openExternalParam = search.get("external");
        const forceExternal = openExternalParam === "1" || openExternalParam === "true";
        const openExternal: boolean = forceExternal ? true : Boolean(data.openExternal);
        const isInClient = window.liff.isInClient ? window.liff.isInClient() : false;

        console.log("7. 移動先:", { destination, openExternal, isInClient });
        setStatus(buildStatus("ページを開いています..."));

        if (isInClient) {
          if (openExternal) {
            window.liff.openWindow({ url: destination, external: true });
            setTimeout(() => {
              try {
                window.liff?.closeWindow?.();
              } catch (_) {
                /* noop */
              }
            }, 500);
          } else {
            window.location.replace(destination);
          }
        } else {
          window.location.replace(destination);
        }
      } catch (err) {
        console.error("=== LIFF Auth エラー ===", err);
        const params = new URLSearchParams(window.location.search);
        const fallback = decodeParam(params.get("fallback"));
        if (fallback) {
          console.log("フォールバックURLに移動:", fallback);
          window.location.replace(fallback);
          return;
        }
        setError((err as Error)?.message ?? "予期しないエラーが発生しました");
      }
    };

    run();
  }, []);

  const message = error ? "リダイレクトに失敗しました" : status.message;
  const description = error ?? status.description ?? "しばらくお待ちください";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 max-w-sm px-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <h2 className="text-xl font-semibold text-foreground">{message}</h2>
        <p className="text-muted-foreground whitespace-pre-line">{description}</p>
      </div>
    </div>
  );
}

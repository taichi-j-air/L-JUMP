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

type NullableString = string | null;

const coalesce = (...values: NullableString[]): string | null => {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
};

const parseStateParams = (rawState: string) => {
  const decodedState = decodeURIComponent(rawState);
  const normalizedState = decodedState.startsWith("?") ? decodedState.slice(1) : decodedState;
  return new URLSearchParams(normalizedState);
};

export default function LiffAuth() {
  const [status, setStatus] = useState(buildStatus("準備中..."));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        console.log("=== LIFF Auth Debug Start ===");

        if (typeof window === "undefined") {
          throw new Error("このページはブラウザで実行する必要があります");
        }

        const search = new URLSearchParams(window.location.search);

        let ownerUserId = coalesce(search.get("userId"), search.get("user_id"));
        let rawTarget = coalesce(decodeParam(search.get("target")), decodeParam(search.get("target_url")));
        let fallbackUrl = decodeParam(search.get("fallback"));
        let liffId = coalesce(
          search.get("liffId"),
          search.get("liff_id"),
          search.get("liffClientId"),
          search.get("liff_client_id"),
        );

        const liffStateParam = search.get("liff.state");
        if (liffStateParam) {
          try {
            const stateParams = parseStateParams(liffStateParam);

            ownerUserId ||= coalesce(stateParams.get("userId"), stateParams.get("user_id"));
            rawTarget ||= coalesce(decodeParam(stateParams.get("target")), decodeParam(stateParams.get("target_url")));
            fallbackUrl ||= decodeParam(stateParams.get("fallback"));
            liffId ||= coalesce(
              stateParams.get("liffId"),
              stateParams.get("liff_id"),
              stateParams.get("liffClientId"),
              stateParams.get("liff_client_id"),
            );

            console.log("liff.state から追加パラメータを取得", {
              decodedState: decodeURIComponent(liffStateParam),
              ownerUserId,
              rawTarget,
              liffId,
              fallbackUrl,
            });
          } catch (stateErr) {
            console.warn("liff.state のパースに失敗", stateErr);
          }
        }

        console.log("1. パラメータ", { ownerUserId, rawTarget, liffId, fallbackUrl });

        if (!ownerUserId) throw new Error("userIdパラメータがありません");
        if (!rawTarget) throw new Error("targetパラメータがありません");

        setStatus(buildStatus("LIFFを読み込んでいます..."));
        await loadLiffSdk();
        console.log("2. LIFF SDK読み込み完了", !!window.liff);

        if (!window.liff) throw new Error("LIFF SDKが利用できません");

        if (!liffId) {
          const runtimeLiffId = coalesce(
            (window.liff?.id as NullableString) ?? null,
            ((window.liff as unknown as { liffId?: string }).liffId ?? null) as NullableString,
            search.get("liffClientId"),
            search.get("liff_client_id"),
          );

          if (runtimeLiffId) {
            liffId = runtimeLiffId;
            console.log("[LIFF] SDK から取得した LIFF ID を利用", liffId);
          }
        }

        if (!liffId) throw new Error("liffIdパラメータがありません");

        setStatus(buildStatus("LIFFを初期化中..."));
        await window.liff.init({ liffId });
        console.log("3. LIFF初期化完了");

        if (!window.liff.isLoggedIn()) {
          setStatus(buildStatus("LINEログインに移動しています..."));
          console.log("4. LINEログインへリダイレクト");
          window.liff.login({ redirectUri: window.location.href });
          return;
        }

        setStatus(buildStatus("プロフィールを取得中..."));
        const context = window.liff.getContext ? window.liff.getContext() : null;
        const profile = await window.liff.getProfile();
        const lineUserId: string | undefined = context?.userId || profile?.userId;
        console.log("4. LINE ユーザーID取得", lineUserId ? "成功" : "失敗");

        if (!lineUserId) {
          throw new Error("LINE ユーザーIDを取得できませんでした");
        }

        setStatus(buildStatus("移動先を準備中..."));
        console.log("5. Edge Function 呼び出し開始");

        let destination: string | null = null;
        let usedFallback = false;

        try {
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error("タイムアウト: サーバーからの応答がありません (30秒)")), 30000);
          });

          const invokePromise = supabase.functions.invoke("liff-rich-menu-redirect", {
            body: {
              ownerUserId,
              lineUserId,
              target: rawTarget,
            },
          });

          const { data, error: fnError } = (await Promise.race([invokePromise, timeoutPromise])) as any;

          console.log("6. Edge Function 応答", { success: data?.success, hasUrl: !!data?.url, error: fnError, status: (fnError as any)?.status });

          if (fnError) {
            console.error("liff-rich-menu-redirect エラー", fnError, "status:", (fnError as any)?.status);
            throw new Error(fnError.message ?? "リダイレクト先URLの解決に失敗しました");
          }

          if (!data?.success || !data.url) {
            const errorMsg = data?.error ?? "リダイレクト先URLの解決に失敗しました";
            console.error("Edge Function 失敗", errorMsg);
            throw new Error(errorMsg);
          }

          destination = data.url;
        } catch (invokeError) {
          console.warn("Edge Function 呼び出し失敗、フォールバック実行", invokeError);
          
          const cleanTarget = rawTarget.replace(/\[UID\]/g, "");
          if (cleanTarget && (cleanTarget.startsWith("http://") || cleanTarget.startsWith("https://"))) {
            console.log("フォールバック: 元のURLに直接移動", cleanTarget);
            destination = cleanTarget;
            usedFallback = true;
          } else {
            throw invokeError;
          }
        }

        if (typeof destination === "string" && destination.includes("[UID]")) {
          console.warn("UID が未解決のままです", destination);
        }

        const openExternalParam = search.get("external");
        const forceExternal = openExternalParam === "1" || openExternalParam === "true";
        const openExternal: boolean = usedFallback ? false : forceExternal;
        const isInClient = window.liff.isInClient ? window.liff.isInClient() : false;

        console.log("7. 移動先", { destination, openExternal, isInClient });
        setStatus(buildStatus("ページを開いています..."));

        if (cancelled) return;

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
        if (cancelled) return;

        console.error("=== LIFF Auth エラー ===", err);
        const params = new URLSearchParams(window.location.search);
        const fallback = decodeParam(params.get("fallback"));
        if (fallback) {
          console.log("フォールバックURLに移動", fallback);
          window.location.replace(fallback);
          return;
        }
        setError((err as Error)?.message ?? "予期しないエラーが発生しました");
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  const message = error ? "リダイレクトに失敗しました" : status.message;
  const description = error ?? status.description ?? "しばらくお待ちください";

  const search = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const isDebug = search.get("debug") === "1";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 max-w-sm px-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <h2 className="text-xl font-semibold text-foreground">{message}</h2>
        <p className="text-muted-foreground whitespace-pre-line">{description}</p>

        {isDebug && (
          <div className="mt-6 p-4 bg-muted rounded-lg text-left text-xs space-y-2">
            <p className="font-bold mb-2">🔍 デバッグ情報</p>
            <div className="space-y-1">
              <p><strong>Stage:</strong> {status.message}</p>
              <p><strong>userId:</strong> {search.get("userId") || search.get("user_id") || "なし"}</p>
              <p><strong>target:</strong> {search.get("target") || search.get("target_url") || "なし"}</p>
              <p><strong>liffId:</strong> {search.get("liffId") || search.get("liff_id") || search.get("liffClientId") || search.get("liff_client_id") || "なし"}</p>
              <p><strong>fallback:</strong> {search.get("fallback") || "なし"}</p>
              {search.get("liff.state") && <p><strong>liff.state:</strong> {search.get("liff.state")}</p>}
              {error && (
                <div className="mt-2 p-2 bg-red-100 text-red-800 rounded">
                  <p><strong>❌ Error:</strong> {error}</p>
                </div>
              )}
              <p className="mt-2 break-all"><strong>現在のURL:</strong> {typeof window !== "undefined" ? window.location.href : ""}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

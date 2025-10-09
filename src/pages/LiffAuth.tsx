import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    liff?: any;
  }
}

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
  const [status, setStatus] = useState(buildStatus("Preparing..."));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        if (typeof window === "undefined") {
          throw new Error("This page must run in a browser");
        }

        const search = new URLSearchParams(window.location.search);
        const ownerUserId = search.get("userId")?.trim();
        const rawTarget = decodeParam(search.get("target"));
        const fallbackUrl = decodeParam(search.get("fallback"));
        const liffId = search.get("liffId")?.trim() || search.get("liff_id")?.trim();

        if (!ownerUserId) throw new Error("Missing userId parameter");
        if (!rawTarget) throw new Error("Missing target parameter");
        if (!liffId) throw new Error("Missing liffId parameter");

        setStatus(buildStatus("Loading LIFF SDK"));
        await loadLiffSdk();

        if (!window.liff) throw new Error("LIFF SDK is not available");

        setStatus(buildStatus("Initialising LIFF"));
        await window.liff.init({ liffId });

        if (!window.liff.isLoggedIn()) {
          setStatus(buildStatus("Redirecting to LINE login"));
          window.liff.login({ redirectUri: window.location.href });
          return;
        }

        setStatus(buildStatus("Fetching profile"));
        const context = window.liff.getContext ? window.liff.getContext() : null;
        const profile = await window.liff.getProfile();
        const lineUserId: string | undefined = context?.userId || profile?.userId;

        if (!lineUserId) {
          throw new Error("Unable to obtain LINE user id");
        }

        setStatus(buildStatus("Preparing redirect"));
        const { data, error: fnError } = await supabase.functions.invoke("liff-rich-menu-redirect", {
          body: {
            ownerUserId,
            lineUserId,
            target: rawTarget,
          },
        });

        if (fnError) {
          console.error("liff-rich-menu-redirect failure", fnError);
          throw new Error(fnError.message ?? "Failed to resolve redirect URL");
        }

        if (!data?.success || !data.url) {
          throw new Error(data?.error ?? "Failed to resolve redirect URL");
        }

        const destination: string = data.url;
        const openExternalParam = search.get("external");
        const forceExternal = openExternalParam === "1" || openExternalParam === "true";
        const openExternal: boolean = forceExternal ? true : Boolean(data.openExternal);
        const isInClient = window.liff.isInClient ? window.liff.isInClient() : false;

        setStatus(buildStatus("Opening destination"));

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
        console.error("LIFF redirect error", err);
        const params = new URLSearchParams(window.location.search);
        const fallback = decodeParam(params.get("fallback")) ?? fallbackUrl;
        if (fallback) {
          window.location.replace(fallback);
          return;
        }
        setError((err as Error)?.message ?? "An unexpected error occurred");
      }
    };

    run();
  }, []);

  const message = error ? "Redirect failed" : status.message;
  const description = error ?? status.description ?? "Please wait";

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

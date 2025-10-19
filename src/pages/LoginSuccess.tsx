import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

export default function LoginSuccess() {
  const [searchParams] = useSearchParams();
  const [countdown, setCountdown] = useState(5);

  const userName = searchParams.get('user_name');
  const scenario = searchParams.get('scenario');
  const nextParam = searchParams.get('next');

  const defaultTarget = '/auth?line_login=success';

  const sanitizeNext = (raw: string | null) => {
    if (!raw) return defaultTarget;
    if (typeof window === "undefined") return '/';
    try {
      const base = window.location.origin;
      const resolved = new URL(raw, base);
      if (resolved.origin !== base) {
        return defaultTarget;
      }
      const combined = `${resolved.pathname}${resolved.search}${resolved.hash}` || '/';
      return combined;
    } catch {
      if (raw.startsWith('/')) return raw;
      return defaultTarget;
    }
  };

  const targetUrl = sanitizeNext(nextParam);
  const finalTarget = targetUrl === '/' ? defaultTarget : targetUrl;

  useEffect(() => {
    // シナリオ招待の場合は最初のステップ配信をトリガー
    if (scenario) {
      console.log("Triggering first step delivery for scenario:", scenario);
      // 少し遅延を入れて確実に登録が完了してからトリガー
      setTimeout(() => {
        fetch(`https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/scheduled-step-delivery`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ trigger: 'login_success' })
        }).catch(error => {
          console.error("Failed to trigger step delivery:", error);
        });
      }, 2000);
    }

    // 5秒後に自動でリダイレクト
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          window.location.assign(finalTarget);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [scenario, finalTarget]);

  const handleManualRedirect = () => {
    window.location.assign(finalTarget);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-100">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <CheckCircle className="w-16 h-16 text-green-500" />
          </div>
          <CardTitle className="text-green-600">LINEログイン成功！</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {userName && (
            <p className="text-gray-600">
              ようこそ、<strong>{decodeURIComponent(userName)}</strong>さん
            </p>
          )}
          
          {scenario && (
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm text-blue-700">
                シナリオ「{scenario}」にご登録いただきました。
                <br />
                まもなくステップ配信が開始されます。
              </p>
            </div>
          )}

          <div className="border-t pt-4">
            <p className="text-sm text-gray-500 mb-3">
              {countdown}秒後に自動的にページが移動します
            </p>
            
            <Button 
              onClick={handleManualRedirect}
              className="w-full"
            >
              次のページへ移動する
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

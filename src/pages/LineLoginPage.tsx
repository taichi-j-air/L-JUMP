import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function LineLoginPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  const scenario = searchParams.get('scenario');

  useEffect(() => {
    // モバイル判定
    const checkMobile = /mobile|android|iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsMobile(checkMobile);

    // scenarioパラメータが必要
    if (!scenario) {
      setError("シナリオパラメータが指定されていません");
      return;
    }

    // モバイルの場合は自動的にLINEログインを開始
    if (checkMobile) {
      initiateLineLogin();
    }
  }, [scenario]);

  const initiateLineLogin = async () => {
    if (!scenario) {
      setError("シナリオが指定されていません");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // シナリオ情報を取得してLINEログインURLを生成
      const { data, error } = await supabase
        .from("scenario_invite_codes")
        .select(`
          step_scenarios!inner (
            profiles!inner (
              line_login_channel_id,
              line_login_channel_secret
            )
          )
        `)
        .eq("invite_code", scenario)
        .eq("is_active", true)
        .maybeSingle();

      if (error || !data) {
        throw new Error("無効なシナリオコードです");
      }

      const profile = data.step_scenarios.profiles;
      if (!profile.line_login_channel_id) {
        throw new Error("LINEログイン設定が見つかりません");
      }

      // LINEログイン認証URLを生成
      const redirectUri = "https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/login-callback";
      const lineLoginUrl = 
        `https://access.line.me/oauth2/v2.1/authorize` +
        `?response_type=code` +
        `&client_id=${profile.line_login_channel_id}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&state=${scenario}` +
        `&scope=profile%20openid` +
        `&bot_prompt=aggressive`;

      console.log("Generated LINE login URL:", lineLoginUrl);
      
      // LINEログイン画面にリダイレクト
      window.location.href = lineLoginUrl;

    } catch (err: any) {
      console.error("LINE login initiation failed:", err);
      setError(err.message || "LINEログインの開始に失敗しました");
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">LINEログイン</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p>LINEログイン画面に移動中...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-pink-100">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-red-600">エラー</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button 
              onClick={() => navigate('/')} 
              variant="outline" 
              className="w-full"
            >
              ホームに戻る
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // PC表示用 - QRコード表示ではなく、ログインボタン
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-100">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">LINEログイン認証</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-4">
            <p className="text-gray-600">
              シナリオ「{scenario}」への登録にはLINEログインが必要です
            </p>
            
            <Button 
              onClick={initiateLineLogin}
              className="w-full bg-green-500 hover:bg-green-600 text-white"
              size="lg"
            >
              LINEでログイン
            </Button>
            
            <div className="text-sm text-gray-500 mt-4">
              <p>• LINEアプリでの認証が必要です</p>
              <p>• 認証後、自動的にシナリオ配信が開始されます</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function LineLoginPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const scenario = searchParams.get('scenario');

  useEffect(() => {
    // scenarioパラメータが必要
    if (!scenario) {
      setError("シナリオパラメータが指定されていません");
      return;
    }

    // 即座にエッジ関数にリダイレクトしてLINE認証を開始
    const redirectToLineLogin = () => {
      const edgeFunctionUrl = `https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/scenario-login?scenario=${encodeURIComponent(scenario)}`;
      window.location.href = edgeFunctionUrl;
    };

    redirectToLineLogin();
  }, [scenario]);

  // ローディング表示（リダイレクト中）
  if (!error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">LINEログイン</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p>LINE認証画面に移動中...</p>
              <p className="text-sm text-gray-500 mt-2">自動的にLINE認証ページにリダイレクトされます</p>
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

  return null; // エラー表示は既に上で処理済み
}
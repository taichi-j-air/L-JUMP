import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

export default function LoginSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(5);

  const userName = searchParams.get('user_name');
  const scenario = searchParams.get('scenario');

  useEffect(() => {
    // 5秒後に自動でリダイレクト
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate]);

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
              onClick={() => navigate('/')}
              className="w-full"
            >
              今すぐホームに戻る
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { QRCodeCanvas } from "qrcode.react";

export default function InvitePage() {
  const { inviteCode } = useParams();
  // クエリパラメータまたはパスパラメータから招待コードを取得
  const qsCode = new URLSearchParams(window.location.search).get('code');
  const code = (qsCode || inviteCode || '').trim();
  
  // UAベースのモバイル/LINE判定のみ（横幅ベースは誤判定の原因になるため使用しない）
  const ua = navigator.userAgent || "";
  const isMobileUA = /iPhone|iPad|iPod|Android/i.test(ua);
  const isLineInApp = /Line\//i.test(ua);
  const shouldRedirectMobile = isMobileUA || isLineInApp;

  const [authorizeUrl, setAuthorizeUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 招待コードが無い場合はエラー表示
    if (!code) {
      setError("招待コードが指定されていません。");
      setLoading(false);
      return;
    }

    // Edge Function (scenario-invite) のベースURL
    const base = "https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/scenario-invite";
    // モバイル/LINE内ブラウザは即リダイレクト（UIを見せない）
    if (shouldRedirectMobile) {
      window.location.replace(`${base}?code=${encodeURIComponent(code)}`);
      return;
    }

    const fetchAuthorizeUrl = async () => {
      try {
        // PCはQR表示用に最終URL(JSON)を取得（デフォルトはOA/トーク起動）
        const res = await fetch(`${base}?code=${encodeURIComponent(code)}&format=json`, {
          headers: {
            'Accept': 'application/json'
          }
        });
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error("招待リンクが無効か、使用上限に達しています。");
          }
          throw new Error("認証URLの取得に失敗しました");
        }
        const json = await res.json();
        // Edge Functionは authUrl を返す（authorizeUrl との両対応）
        setAuthorizeUrl(json.authUrl || json.authorizeUrl);
      } catch (e: any) {
        console.error(e);
        setError(e.message || "エラーが発生しました");
      } finally {
        setLoading(false);
      }
    };

    fetchAuthorizeUrl();
  }, [code, shouldRedirectMobile]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-4" />
          <p>読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">エラー</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button onClick={() => (window.location.href = "/")}>ホームに戻る</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-center">LINEログイン（QR認証）</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {authorizeUrl ? (
            <>
              <div className="p-4 rounded-lg">
                <QRCodeCanvas value={authorizeUrl} size={240} includeMargin />
              </div>
              <p className="text-sm opacity-80 text-center">スマホのカメラでQRコードを読み取り、LINEで認証してください。</p>
              <Button onClick={() => (window.location.href = authorizeUrl)} className="mt-2">
                LINEでログインを開く
              </Button>
            </>
          ) : (
            <p>認証URLを取得できませんでした。</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

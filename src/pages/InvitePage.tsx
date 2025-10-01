import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { QRCodeCanvas } from "qrcode.react";

export default function InvitePage() {
  const { inviteCode } = useParams();
  const code = inviteCode || window.location.pathname.split("/").pop() || "";
  const isMobile = useIsMobile();
  // In-app LINE ブラウザやUAベースでもモバイル判定（幅だけだと誤判定が起きるため）
  const ua = navigator.userAgent || "";
  const isMobileUA = /iPhone|iPad|iPod|Android/i.test(ua);
  const isLineInApp = /Line\//i.test(ua);
  const shouldRedirectMobile = isMobile || isMobileUA || isLineInApp;

  const [authorizeUrl, setAuthorizeUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;

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
        const res = await fetch(`${base}?code=${encodeURIComponent(code)}&format=json`);
        if (!res.ok) throw new Error("認証URLの取得に失敗しました");
        const json = await res.json();
        setAuthorizeUrl(json.authorizeUrl);
      } catch (e: any) {
        console.error(e);
        setError(e.message || "エラーが発生しました");
      } finally {
        setLoading(false);
      }
    };

    fetchAuthorizeUrl();
  }, [code, isMobile]);

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

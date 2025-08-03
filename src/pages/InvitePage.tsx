import { useEffect } from "react";

export default function InvitePage() {
  const code = window.location.pathname.split("/").pop() ?? "";
  const isMobile = /mobile|android|iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    // モバイルアクセス時は scenario-invite にリダイレクト（OAuth認証）
    if (isMobile && code) {
      console.log("Mobile access detected, redirecting to OAuth flow");
      window.location.href = `https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/scenario-invite?code=${code}`;
      return;
    }
  }, [code, isMobile]);

  if (isMobile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p>リダイレクト中...</p>
        </div>
      </div>
    );
  }

  /* ---- PC 用 QR 表示 ---- */
  const inviteUrl = `https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/scenario-invite?code=${code}`;
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(inviteUrl)}`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow text-center">
        <h1 className="text-xl font-bold mb-4">LINE 友だち追加</h1>
        <img src={qr} alt="qr" className="mx-auto mb-4 border" />
        <p className="text-sm text-gray-600">
          スマホで QR を読み取ると LINE アプリが起動します
        </p>
      </div>
    </div>
  );
}
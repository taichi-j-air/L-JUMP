import { useEffect, useState } from "react";

export default function InvitePage() {
  const code = window.location.pathname.split("/").pop() ?? "";
  const isMobile = /mobile|android|iphone|ipad|ipod/i.test(navigator.userAgent);
  const liffId = import.meta.env.VITE_LIFF_ID;

  useEffect(() => {
    if (isMobile && liffId && code) {
      window.location.href = `https://liff.line.me/${liffId}?code=${code}`;
    }
  }, []);

  if (isMobile) return null; // リダイレクト済み

  /* ---- PC 用 QR 表示 ---- */
  const url = `https://liff.line.me/${liffId}?code=${code}`;
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`;

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
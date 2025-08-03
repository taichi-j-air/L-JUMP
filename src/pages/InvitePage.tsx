import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function InvitePage() {
  const code = window.location.pathname.split("/").pop() ?? "";
  const isMobile = /mobile|android|iphone|ipad|ipod/i.test(navigator.userAgent);
  const [liffId, setLiffId] = useState<string>("");

  useEffect(() => {
    // LIFF IDを取得
    const fetchLiffId = async () => {
      if (!code) return;
      
      const { data } = await supabase
        .from("scenario_invite_codes")
        .select(`
          step_scenarios!inner (
            profiles!inner (
              liff_id
            )
          )
        `)
        .eq("invite_code", code)
        .eq("is_active", true)
        .single();
      
      const fetchedLiffId = data?.step_scenarios?.profiles?.liff_id;
      if (fetchedLiffId) {
        setLiffId(fetchedLiffId);
      }
    };
    
    fetchLiffId();
  }, [code]);

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
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function InvitePage() {
  const code = window.location.pathname.split("/").pop() ?? "";
  const userAgent = navigator.userAgent;
  const isMobile = /mobile|android|iphone|ipad|ipod|line/i.test(userAgent);
  const [liffId, setLiffId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("🔍 [InvitePage] User Agent:", userAgent);
    console.log("🔍 [InvitePage] Is Mobile/LINE detected:", isMobile);
    console.log("🔍 [InvitePage] Invite code:", code);
    
    // モバイル/LINEブラウザの場合は直接リダイレクト
    if (isMobile) {
      const inviteUrl = `https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/scenario-invite?code=${code}`;
      console.log("🔍 [InvitePage] Redirecting to:", inviteUrl);
      window.location.href = inviteUrl;
      return;
    }

    // PC用のLIFF IDを取得
    const fetchLiffId = async () => {
      if (!code) {
        setLoading(false);
        return;
      }
      
      try {
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
      } catch (error) {
        console.error("🔍 [InvitePage] Error fetching LIFF ID:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchLiffId();
  }, [code, isMobile, userAgent]);

  if (isMobile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p>LINEアプリに移動中...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>読み込み中...</p>
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
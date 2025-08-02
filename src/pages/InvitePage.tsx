import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function InvitePage() {
  const code = window.location.pathname.split("/").pop() ?? "";
  const isMobile = /mobile|android|iphone|ipad|ipod/i.test(navigator.userAgent);
  const [inviteUrl, setInviteUrl] = useState<string>("");

  useEffect(() => {
    // 招待URLを構築
    const fetchInviteUrl = async () => {
      if (!code) return;
      
      const { data } = await supabase
        .from("scenario_invite_codes")
        .select(`
          step_scenarios!inner (
            profiles!inner (
              line_login_channel_id
            )
          )
        `)
        .eq("invite_code", code)
        .eq("is_active", true)
        .single();
      
      const channelId = data?.step_scenarios?.profiles?.line_login_channel_id;
      if (channelId) {
        const redirectUri = "https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/login-callback";
        const scope = "profile%20openid";
        const state = code;
        const botPrompt = "normal";
        
        const loginUrl = `https://access.line.me/oauth2/v2.1/authorize?` +
          `response_type=code&` +
          `client_id=${channelId}&` +
          `redirect_uri=${encodeURIComponent(redirectUri)}&` +
          `state=${state}&` +
          `scope=${scope}&` +
          `bot_prompt=${botPrompt}`;
          
        setInviteUrl(loginUrl);
      }
    };
    
    fetchInviteUrl();
  }, [code, isMobile]);

  if (isMobile) return null; // リダイレクト済み

  /* ---- PC 用 QR 表示 ---- */
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
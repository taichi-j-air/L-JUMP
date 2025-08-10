import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    liff: any;
  }
}

export default function LiffInvitePage() {
  const [status, setStatus] = useState<string>("初期化中...");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    // URLパラメータから招待コードを取得
    const urlParams = new URLSearchParams(window.location.search);
    const inviteCode = urlParams.get('code');

    if (!inviteCode) {
      setError("招待コードが見つかりません");
      return;
    }

    // LIFF初期化
    const initializeLiff = async () => {
      try {
        await window.liff.init({ liffId: window.liff.id });
        
        if (!window.liff.isLoggedIn()) {
          setStatus("LINE ログインが必要です");
          window.liff.login();
          return;
        }

        setStatus("ユーザー情報を取得中...");
        
        // LINE ユーザー情報を取得
        const profile = await window.liff.getProfile();
        const lineUserId = profile.userId;

        setStatus("友だち状態を確認中...");

        // 友だち状態をチェック
        const { data, error } = await supabase.functions.invoke('check-friend-status', {
          body: {
            lineUserId,
            inviteCode
          }
        });

        if (error) {
          throw new Error(error.message);
        }

        if (data.isFriend) {
          setStatus("シナリオ配信を開始しました！");
          // 成功ページに遷移またはLIFFを閉じる
          setTimeout(() => {
            window.liff.closeWindow();
          }, 2000);
        } else {
          setStatus("友だち追加が必要です");
          // プロファイル情報を取得して友だち追加URLを生成（埋め込みを避ける）
          const { data: inviteRow, error: inviteRowErr } = await supabase
            .from("scenario_invite_codes")
            .select("user_id")
            .eq("invite_code", inviteCode)
            .eq("is_active", true)
            .single();

          if (inviteRowErr || !inviteRow) {
            setError("設定情報の取得に失敗しました");
            return;
          }

          const { data: prof, error: profErr } = await supabase
            .from("profiles")
            .select("line_bot_id")
            .eq("user_id", inviteRow.user_id)
            .single();

          if (profErr || !prof) {
            setError("設定情報の取得に失敗しました");
            return;
          }

          const botId = prof.line_bot_id;
          if (botId) {
            const id = botId.startsWith("@") ? botId : `@${botId}`;
            const addFriendUrl = `https://line.me/R/ti/p/${id}?state=${encodeURIComponent(inviteCode)}`;
            
            setStatus("友だち追加ページに移動中...");
            window.location.href = addFriendUrl;
          } else {
            setError("LINE Bot設定が不完全です");
          }
        }

      } catch (err: any) {
        console.error('LIFF initialization error:', err);
        setError(`エラー: ${err.message}`);
      }
    };

    // LIFF SDKが読み込まれているかチェック
    if (window.liff) {
      initializeLiff();
    } else {
      setError("LIFF SDKが読み込まれていません");
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 text-center max-w-md w-full">
        <h1 className="text-xl font-bold mb-4 text-gray-800">
          LINE 友だち招待
        </h1>
        
        {error ? (
          <div className="text-red-600 p-4 bg-red-50 rounded-lg">
            {error}
          </div>
        ) : (
          <div className="text-gray-600">
            <div className="animate-spin inline-block w-6 h-6 border-2 border-current border-t-transparent rounded-full mb-4"></div>
            <p>{status}</p>
          </div>
        )}
      </div>
    </div>
  );
}
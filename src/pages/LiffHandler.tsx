import { useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";

const LiffHandler = () => {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string|null>(null)
  const [success, setSuccess] = useState(false)

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const errorParam = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  useEffect(() => {
    if (errorParam) {
      setError(errorDescription || errorParam);
      setLoading(false)
      return;
    }

    // code, stateが来ていたらサーバーへ交換リクエスト
    if (code && state) {
      fetch('/functions/v1/api-exchange-line-token', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, state })
      })
      .then(res => {
        if (!res.ok) throw new Error('Backend error');
        return res.json();
      })
      .then(data => {
        // 必要に応じてユーザー情報やLINE userIdもdataから取得
        setSuccess(true)
      })
      .catch(e => {
        setError(e.message)
      })
      .finally(() => setLoading(false))
    } else {
      setError("認証情報（code, state）がありません")
      setLoading(false)
    }
  }, [code, state, errorParam, errorDescription]);

  if (loading) return <div>認証処理中...</div>
  if (error) return <div>エラー: {error}</div>
  if (success) return <div>連携が完了しました。自動で画面が遷移する場合もあります。</div>
  return null
};

export default LiffHandler;
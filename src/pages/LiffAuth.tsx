import { useEffect } from 'react'

declare global {
  interface Window {
    liff: any;
  }
}

export default function LiffAuth() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const script = document.createElement('script')
      script.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js'
      script.onload = () => {
        // LIFF IDは設定から取得する（後で動的にする）
        const liffId = '2007859465-L5VQg5q9' // 一時的にハードコード
        
        window.liff.init({ liffId })
          .then(() => {
            if (!window.liff.isLoggedIn()) {
              // ログインしていない場合、LINE認証画面を表示
              window.liff.login()
            } else {
              // ログイン済みの場合、プロフィール情報を取得
              window.liff.getProfile().then((profile: any) => {
                console.log('LIFF Profile:', profile)
                // 認証完了後、招待ページにリダイレクト
                window.location.href = '/invite'
              }).catch((error: any) => {
                console.error('Profile取得エラー:', error)
                window.location.href = '/error'
              })
            }
          })
          .catch((error: any) => {
            console.error('LIFF初期化エラー:', error)
            window.location.href = '/error'
          })
      }
      
      script.onerror = () => {
        console.error('LIFF SDK読み込みエラー')
        window.location.href = '/error'
      }
      
      document.head.appendChild(script)
    }
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <h2 className="text-xl font-semibold text-foreground">LINE認証中...</h2>
        <p className="text-muted-foreground">しばらくお待ちください</p>
      </div>
    </div>
  )
}
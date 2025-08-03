// src/pages/LiffHandler.tsx
import { useEffect } from "react"
import liff from "@line/liff"

export default function LiffHandler() {
  const inviteCode = new URLSearchParams(location.search).get("inviteCode") ?? ""
  useEffect(() => {
    ;(async () => {
      await liff.init({ liffId: "2007859465-L5VQg5q9" })
      // 必ず state に inviteCode を渡す
      liff.login({
        redirectUri:
          "https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/login-callback",
        state: inviteCode,
        scope: "profile openid",
        botPrompt: "aggressive",
      })
    })()
  }, [inviteCode])

  return (
    <div style={{ display: "grid", placeItems: "center", height: "100vh" }}>
      LINE にリダイレクトしています…
    </div>
  )
}

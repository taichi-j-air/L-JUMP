import { useEffect } from 'react'
import liff from '@line/liff'
import { supabase } from '@/integrations/supabase/client'

export default function LiffHandler() {
  // ✅ 正しいクエリ名
  const inviteCode = new URLSearchParams(location.search).get('inviteCode')

  useEffect(() => {
    (async () => {
      console.log('=== LiffHandler START ===')
      console.log('inviteCode:', inviteCode)
      if (!inviteCode) return console.error('inviteCode param missing')

      /* ① DB から liffId と channelId を取得 */
      const { data, error } = await supabase
        .from('scenario_invite_codes')
        .select(`
          step_scenarios!inner (
            profiles!inner (
              liff_id,
              line_login_channel_id
            )
          )
        `)
        .eq('invite_code', inviteCode)
        .eq('is_active', true)
        .single()

      if (error || !data?.step_scenarios?.profiles)
        return console.error('DB fetch error:', error)

      const { liff_id: liffId } = data.step_scenarios.profiles

      /* ② LIFF 初期化 */
      await liff.init({ liffId })
      console.log('liff.init OK')

      /* ③ 未ログインなら LINE Login へ */
      if (!liff.isLoggedIn()) {
        liff.login({
          redirectUri:
            'https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/login-callback',
          state: inviteCode,          // ⭐ callback でシナリオ判定
          scope: 'profile openid',    // ⭐ ID トークン取得
          botPrompt: 'aggressive',    // ⭐ 友だち追加画面を強制表示
        })
        return
      }

      /* ④ ログイン完了後の処理 */
      window.location.replace('/#/complete') // ← 好みで遷移先を変更
    })()
  }, [inviteCode])

  return (
    <div className="grid h-screen place-items-center">
      <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-green-500" />
    </div>
  )
}

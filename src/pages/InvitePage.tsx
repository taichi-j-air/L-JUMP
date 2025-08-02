import { useState, useEffect } from "react"
import { useParams } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { supabase } from "@/integrations/supabase/client"
import { QRCodeSVG } from "qrcode.react"
import { Smartphone, Monitor, UserPlus, Gift, ArrowRight, Clock } from "lucide-react"

export default function InvitePage() {
  const { inviteCode } = useParams()
  const [scenarioData, setScenarioData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const [countdown, setCountdown] = useState(3)

  useEffect(() => {
    // デバイス判定：User-Agentからモバイルデバイスを検出
    const checkDevice = () => {
      const userAgent = navigator.userAgent.toLowerCase()
      const mobileKeywords = ['mobile', 'android', 'iphone', 'ipad', 'ipod']
      return mobileKeywords.some(keyword => userAgent.includes(keyword))
    }
    
    const deviceIsMobile = checkDevice()
    setIsMobile(deviceIsMobile)
    loadScenarioData(deviceIsMobile)
  }, [inviteCode])

  useEffect(() => {
    // スマホの場合は3秒カウントダウンを開始
    if (isMobile && scenarioData && !redirecting) {
      const interval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(interval)
            handleMobileRedirect()
            return 0
          }
          return prev - 1
        })
      }, 1000)
      
      return () => clearInterval(interval)
    }
  }, [isMobile, scenarioData, redirecting])

  const loadScenarioData = async (deviceIsMobile) => {
    try {
      console.log('Loading scenario data for invite code:', inviteCode)
      
      // まず招待コードの存在確認
      const { data: inviteCheck, error: inviteCheckError } = await supabase
        .from('scenario_invite_codes')
        .select('*')
        .eq('invite_code', inviteCode)
        .eq('is_active', true)
        .single()

      console.log('Invite code check:', { inviteCheck, inviteCheckError })

      if (inviteCheckError || !inviteCheck) {
        console.error('Invite code not found:', inviteCheckError)
        throw new Error('招待コードが見つかりません')
      }

      // シナリオ情報取得
      const { data: scenarioCheck, error: scenarioCheckError } = await supabase
        .from('step_scenarios')
        .select(`
          *,
          profiles!inner (
            display_name,
            line_login_channel_id,
            line_channel_id
          )
        `)
        .eq('id', inviteCheck.scenario_id)
        .single()

      console.log('Scenario check:', { scenarioCheck, scenarioCheckError })

      if (scenarioCheckError || !scenarioCheck) {
        console.error('Scenario not found:', scenarioCheckError)
        throw new Error('シナリオが見つかりません')
      }

      // 最終的なデータ構造
      const finalData = {
        ...inviteCheck,
        step_scenarios: scenarioCheck
      }

      console.log('Final scenario data:', finalData)
      setScenarioData(finalData)
      
      // ページビュー記録（統計用）
      await recordPageView(deviceIsMobile)
      
    } catch (error) {
      console.error('シナリオデータ取得エラー:', error)
    } finally {
      setLoading(false)
    }
  }

  const recordPageView = async (deviceIsMobile) => {
    try {
      await supabase.from('invite_page_views').insert({
        invite_code: inviteCode,
        user_agent: navigator.userAgent,
        referer: document.referrer || null,
        device_type: deviceIsMobile ? 'mobile' : 'desktop'
      })
    } catch (error) {
      console.log('ページビュー記録エラー:', error)
    }
  }

  const handleMobileRedirect = () => {
    setRedirecting(true)
    // scenario-invite Edge Functionを経由してLINE Loginへ
    const lineLoginUrl = `${window.location.origin}/scenario-invite?code=${inviteCode}`
    window.location.href = lineLoginUrl
  }

  // ローディング画面
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>読み込み中...</p>
        </div>
      </div>
    )
  }

  // エラー画面（無効な招待コード）
  if (!scenarioData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="text-center p-8">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-red-600 mb-2">無効な招待リンク</h2>
            <p className="text-red-500">このリンクは無効であるか、既に期限切れです。</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // スマホ用画面（3秒カウントダウン → 自動リダイレクト）
  if (isMobile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="max-w-sm w-full shadow-xl">
          <CardHeader className="text-center bg-gradient-to-r from-green-500 to-blue-500 text-white rounded-t-lg">
            <div className="mx-auto mb-4 w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
              <Gift className="h-8 w-8" />
            </div>
            <CardTitle className="text-xl">
              {scenarioData.step_scenarios?.profiles?.display_name || 'LINE公式アカウント'}
            </CardTitle>
            <p className="text-green-100">LINE公式アカウント</p>
          </CardHeader>
          
          <CardContent className="p-6 text-center">
            <h2 className="text-lg font-bold mb-4 text-gray-800">
              {scenarioData.step_scenarios?.name || 'シナリオ'}
            </h2>
            
            {redirecting ? (
              <div className="space-y-4">
                <div className="animate-pulse bg-green-100 p-4 rounded-lg">
                  <ArrowRight className="h-6 w-6 text-green-600 mx-auto mb-2 animate-bounce" />
                  <p className="text-green-700 font-medium">友だち追加ページに移動中...</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                  <Smartphone className="h-8 w-8 text-blue-500 mx-auto mb-3" />
                  <p className="text-blue-700 font-medium mb-2">📱 スマホから開いています</p>
                  <div className="flex items-center justify-center gap-2 text-blue-600">
                    <Clock className="h-4 w-4" />
                    <span className="text-lg font-mono font-bold">{countdown}</span>
                    <span className="text-sm">秒後に自動移動</span>
                  </div>
                </div>
                
                <Button 
                  onClick={handleMobileRedirect}
                  className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3"
                  size="lg"
                >
                  今すぐ友だち追加する
                </Button>
                
                <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                  <p className="text-yellow-800 text-xs">
                    ✨ 友だち追加後、特別なメッセージが自動配信されます
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // PC用画面（QRコード表示）
  const qrUrl = `${window.location.href}`
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-lg mx-auto">
          <Card className="shadow-xl">
            <CardHeader className="text-center bg-gradient-to-r from-green-500 to-blue-500 text-white rounded-t-lg">
              <div className="mx-auto mb-4 w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                <Gift className="h-8 w-8" />
              </div>
              <CardTitle className="text-xl">
                {scenarioData.step_scenarios?.profiles?.display_name || 'LINE公式アカウント'}
              </CardTitle>
              <p className="text-green-100">LINE公式アカウント</p>
            </CardHeader>
            
            <CardContent className="p-8 text-center">
              <h2 className="text-xl font-bold mb-6 text-gray-800">
                {scenarioData.step_scenarios?.name || 'シナリオ'}
              </h2>
              
              <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Monitor className="h-5 w-5 text-yellow-600" />
                  <p className="text-yellow-800 font-medium">PCから開いています</p>
                </div>
                <p className="text-sm text-yellow-700">スマートフォンでQRコードを読み取ってください</p>
              </div>
              
              <div className="mb-6">
                <p className="text-lg font-medium text-gray-700 mb-4">
                  📱 スマホでQRコードを読み取り
                </p>
                
                <div className="bg-white p-6 rounded-xl shadow-inner mx-auto inline-block border-4 border-gray-100">
                  <QRCodeSVG 
                    value={qrUrl}
                    size={240}
                    level="M"
                    includeMargin={true}
                    bgColor="#ffffff"
                    fgColor="#000000"
                  />
                </div>
                
                <p className="text-sm text-gray-600 mt-3">
                  📷 カメラでQRコードを読み取ってください
                </p>
              </div>

              <div className="space-y-4 text-sm text-gray-600">
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <UserPlus className="h-6 w-6 text-green-500 mx-auto mb-2" />
                  <p className="font-medium text-green-700 mb-1">友だち追加後の特典</p>
                  <p className="text-green-600 text-xs">
                    {scenarioData.step_scenarios?.description || '特別なメッセージシーケンスが自動配信されます'}
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="font-bold text-2xl text-blue-600">{scenarioData.usage_count || 0}</div>
                    <div className="text-xs text-blue-700">参加者数</div>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="font-bold text-2xl text-green-600">無料</div>
                    <div className="text-xs text-green-700">登録料</div>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-400">
                  招待コード: {inviteCode}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
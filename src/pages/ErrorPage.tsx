import { useSearchParams } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle, ArrowLeft } from "lucide-react"

export default function ErrorPage() {
  const [searchParams] = useSearchParams()
  const errorType = searchParams.get('type')
  const errorMessage = searchParams.get('message')

  const getErrorInfo = () => {
    switch (errorType) {
      case 'line_auth_error':
        return {
          title: 'LINE認証エラー',
          description: 'LINEログインの認証に失敗しました。もう一度お試しください。'
        }
      case 'missing_code':
        return {
          title: '認証コードエラー',
          description: '認証コードが見つかりません。最初からやり直してください。'
        }
      case 'no_line_settings':
        return {
          title: '設定エラー',
          description: 'LINE Login設定が完了していません。管理者にお問い合わせください。'
        }
      case 'token_error':
        return {
          title: 'トークンエラー',
          description: 'アクセストークンの取得に失敗しました。'
        }
      case 'profile_error':
        return {
          title: 'プロファイルエラー',
          description: 'LINEプロファイル情報の取得に失敗しました。'
        }
      case 'server_error':
        return {
          title: 'サーバーエラー',
          description: 'サーバーで予期しないエラーが発生しました。'
        }
      default:
        return {
          title: 'エラーが発生しました',
          description: '予期しないエラーが発生しました。'
        }
    }
  }

  const errorInfo = getErrorInfo()

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-destructive">{errorInfo.title}</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">{errorInfo.description}</p>
          {errorMessage && (
            <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
              詳細: {decodeURIComponent(errorMessage)}
            </p>
          )}
          <Button onClick={() => window.location.href = '/'} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            ホームに戻る
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
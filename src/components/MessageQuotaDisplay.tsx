import { useState, useEffect } from "react"
import { User } from "@supabase/supabase-js"
import { Progress } from "./ui/progress"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { AlertTriangle, CheckCircle, XCircle } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "./ui/use-toast"

interface MessageQuotaDisplayProps {
  user: User
}

interface QuotaData {
  limit: number
  used: number
  remaining: number
}

export function MessageQuotaDisplay({ user }: MessageQuotaDisplayProps) {
  const [quota, setQuota] = useState<QuotaData | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    loadQuota()
    // 1時間ごとに更新
    const interval = setInterval(loadQuota, 3600000)
    return () => clearInterval(interval)
  }, [user.id])

  const loadQuota = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-message-quota', {
        body: { user_id: user.id }
      })

      if (error) throw error
      setQuota(data)
    } catch (error) {
      console.error('Error loading quota:', error)
      toast({
        title: "配信数の取得に失敗しました",
        description: "しばらく時間をおいて再試行してください",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="text-center text-muted-foreground">
            配信数を読み込み中...
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!quota) return null

  const usagePercentage = (quota.used / quota.limit) * 100
  const getStatusColor = () => {
    if (usagePercentage >= 90) return "text-red-600"
    if (usagePercentage >= 80) return "text-yellow-600"
    return "text-green-600"
  }

  const getStatusIcon = () => {
    if (usagePercentage >= 90) return <XCircle className="h-4 w-4 text-red-600" />
    if (usagePercentage >= 80) return <AlertTriangle className="h-4 w-4 text-yellow-600" />
    return <CheckCircle className="h-4 w-4 text-green-600" />
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          {getStatusIcon()}
          月間配信数
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span>使用済み: {quota.used}通</span>
            <span>上限: {quota.limit}通</span>
          </div>
          <Progress value={usagePercentage} className="w-full" />
          <div className={`text-sm font-medium ${getStatusColor()}`}>
            残り: {quota.remaining}通 ({(100 - usagePercentage).toFixed(1)}%)
          </div>
          {usagePercentage >= 90 && (
            <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
              ⚠️ 配信数の上限に近づいています。送信を控えることをお勧めします。
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
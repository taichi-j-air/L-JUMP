import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Copy, QrCode, Plus, Trash2 } from "lucide-react"
import { StepScenario, ScenarioInviteCode } from "@/hooks/useStepScenarios"
import { toast } from "sonner"

interface ScenarioInviteCardProps {
  scenario: StepScenario
  inviteCodes: ScenarioInviteCode[]
  onGenerateCode: (scenarioId: string, maxUsage?: number) => Promise<ScenarioInviteCode | null>
  onDeactivateCode: (codeId: string) => void
}

export function ScenarioInviteCard({ 
  scenario, 
  inviteCodes, 
  onGenerateCode, 
  onDeactivateCode 
}: ScenarioInviteCardProps) {
  const [maxUsage, setMaxUsage] = useState<string>("")

  const scenarioInviteCodes = inviteCodes.filter(code => 
    code.scenario_id === scenario.id && code.is_active
  )

  const handleGenerateCode = async () => {
    const usage = maxUsage ? parseInt(maxUsage) : undefined
    if (usage && (usage < 1 || usage > 10000)) {
      toast.error("使用回数は1〜10000の範囲で入力してください")
      return
    }
    
    await onGenerateCode(scenario.id, usage)
    setMaxUsage("")
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("URLをコピーしました")
  }

  const generateQRCode = (inviteCode: string) => {
    const url = `https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/scenario-invite?code=${inviteCode}`
    window.open(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`, '_blank')
  }

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm">友達追加URL・QRコード</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pb-3">
        {scenarioInviteCodes.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            まだ招待コードが生成されていません
          </p>
        ) : (
          <div className="space-y-2">
            {scenarioInviteCodes.map((code) => {
              const inviteUrl = `https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/scenario-invite?code=${code.invite_code}`
              
              return (
                <div key={code.id} className="space-y-2 p-2 border rounded">
                  <div className="flex items-center justify-between text-xs">
                    <span>コード: {code.invite_code}</span>
                    <span>使用: {code.usage_count}{code.max_usage ? `/${code.max_usage}` : ''}</span>
                  </div>
                  
                  <div className="space-y-1">
                    <Input
                      value={inviteUrl}
                      readOnly
                      className="h-8 text-xs"
                    />
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(inviteUrl)}
                        className="flex-1 h-7 text-xs"
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        コピー
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateQRCode(code.invite_code)}
                        className="flex-1 h-7 text-xs"
                      >
                        <QrCode className="h-3 w-3 mr-1" />
                        QR表示
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onDeactivateCode(code.id)}
                        className="h-7 text-xs"
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="space-y-2 border-t pt-2">
          <div>
            <Label className="text-xs">使用上限回数（オプション）</Label>
            <Input
              type="number"
              min="1"
              max="10000"
              value={maxUsage}
              onChange={(e) => setMaxUsage(e.target.value)}
              placeholder="制限なし"
              className="h-8"
            />
          </div>
          
          <Button
            onClick={handleGenerateCode}
            size="sm"
            className="w-full h-7 text-xs gap-1"
            disabled={scenarioInviteCodes.length > 0}
          >
            <Plus className="h-3 w-3" />
            招待コード生成
          </Button>
          
          {scenarioInviteCodes.length > 0 && (
            <p className="text-xs text-muted-foreground">
              ※ 1シナリオにつき1つの招待コードのみ有効です
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
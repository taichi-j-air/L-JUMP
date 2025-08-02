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
  const [showCode, setShowCode] = useState(false)

  const scenarioInviteCodes = inviteCodes.filter(code => 
    code.scenario_id === scenario.id && code.is_active
  )

  const handleGenerateCode = async () => {
    await onGenerateCode(scenario.id)
    setShowCode(true)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("URLをコピーしました")
  }

  const generateInviteUrl = (inviteCode: string) => {
    return `https://liff.line.me/${import.meta.env.VITE_LIFF_ID}?code=${inviteCode}`
  }

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm">友達追加URL・QRコード</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pb-3">
        {scenarioInviteCodes.length === 0 && !showCode ? (
          <>
            <p className="text-xs text-muted-foreground">
              友達追加用のコードを生成してください
            </p>
            <Button
              onClick={handleGenerateCode}
              size="sm"
              className="w-full h-7 text-xs gap-1"
            >
              <Plus className="h-3 w-3" />
              コード表示
            </Button>
          </>
        ) : (
          <div className="space-y-2">
            {scenarioInviteCodes.map((code) => {
              const inviteUrl = generateInviteUrl(code.invite_code)
              const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(inviteUrl)}`
              
              return (
                <div key={code.id} className="space-y-2 p-2 border rounded">
                  <div className="flex items-center justify-between text-xs">
                    <span>コード: {code.invite_code}</span>
                    <span>使用: {code.usage_count}回</span>
                  </div>
                  
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs">友達追加URL</Label>
                      <Input
                        value={inviteUrl}
                        readOnly
                        className="h-8 text-xs"
                      />
                    </div>
                    
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
                        onClick={() => onDeactivateCode(code.id)}
                        className="h-7 text-xs"
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                    
                    <div>
                      <Label className="text-xs">QRコード</Label>
                      <div className="flex items-center gap-2">
                        <img 
                          src={qrUrl} 
                          alt="QRコード" 
                          className="w-16 h-16 border rounded"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const link = document.createElement('a')
                            link.href = qrUrl
                            link.download = `qr-${code.invite_code}.png`
                            link.click()
                          }}
                          className="text-xs"
                        >
                          ダウンロード
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
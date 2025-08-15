import { useState } from "react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, AlertTriangle } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"

interface ScenarioExitPreventionToggleProps {
  scenarioId: string
  preventAutoExit: boolean
  scenarioName: string
  onUpdate?: () => void
}

export function ScenarioExitPreventionToggle({
  scenarioId,
  preventAutoExit,
  scenarioName,
  onUpdate
}: ScenarioExitPreventionToggleProps) {
  const [isUpdating, setIsUpdating] = useState(false)

  const handleToggle = async (checked: boolean) => {
    if (isUpdating) return

    setIsUpdating(true)
    try {
      const { error } = await supabase
        .from('step_scenarios')
        .update({ prevent_auto_exit: checked })
        .eq('id', scenarioId)

      if (error) throw error

      toast.success(
        checked 
          ? `${scenarioName}は他シナリオ移行時に解除されなくなりました` 
          : `${scenarioName}は他シナリオ移行時に解除されるようになりました`
      )
      
      if (onUpdate) onUpdate()
    } catch (error: any) {
      console.error('シナリオ解除防止設定の更新に失敗しました:', error)
      toast.error('設定の更新に失敗しました')
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm">シナリオ解除防止設定</CardTitle>
        </div>
        <CardDescription className="text-xs">
          フォーム回答後の他シナリオ移行時に、このシナリオを自動解除しない
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Switch 
              id={`prevent-auto-exit-${scenarioId}`}
              checked={preventAutoExit}
              onCheckedChange={handleToggle}
              disabled={isUpdating}
            />
            <Label 
              htmlFor={`prevent-auto-exit-${scenarioId}`}
              className="text-sm font-medium"
            >
              {preventAutoExit ? '解除防止 ON' : '解除防止 OFF'}
            </Label>
          </div>
          {preventAutoExit && (
            <div className="flex items-center text-orange-600">
              <AlertTriangle className="h-3 w-3 mr-1" />
              <span className="text-xs">保護中</span>
            </div>
          )}
        </div>
        
        {preventAutoExit && (
          <div className="mt-3 p-3 bg-orange-50 rounded-md border border-orange-200">
            <p className="text-xs text-orange-700">
              <strong>注意:</strong> この設定がONの場合、フォーム回答後の他シナリオ移行があっても、
              このシナリオは自動的に解除されません。解除するには友達一覧から手動で行う必要があります。
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { ArrowRight, Plus, X, TestTube } from "lucide-react"
import { StepScenario, ScenarioTransition } from "@/hooks/useStepScenarios"

interface ScenarioTransitionCardProps {
  currentScenario: StepScenario
  availableScenarios: StepScenario[]
  transitions: ScenarioTransition[]
  onAddTransition: (toScenarioId: string) => void
  onRemoveTransition: (transitionId: string) => void
}

export function ScenarioTransitionCard({
  currentScenario,
  availableScenarios,
  transitions,
  onAddTransition,
  onRemoveTransition
}: ScenarioTransitionCardProps) {
  const [selectedScenario, setSelectedScenario] = useState<string>("")
  const [abTestEnabled, setAbTestEnabled] = useState<boolean>(false)
  const [selectedAbScenario, setSelectedAbScenario] = useState<string>("")
  
  const currentTransitions = transitions.filter(t => t.from_scenario_id === currentScenario.id)
  const availableOptions = availableScenarios.filter(s => 
    s.id !== currentScenario.id && 
    !currentTransitions.some(t => t.to_scenario_id === s.id)
  )

  const handleAddTransition = () => {
    if (selectedScenario) {
      onAddTransition(selectedScenario)
      setSelectedScenario("")
    }
  }

  const handleAddAbTransition = () => {
    if (selectedAbScenario) {
      onAddTransition(selectedAbScenario)
      setSelectedAbScenario("")
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <ArrowRight className="h-4 w-4" />
          別シナリオへの移動
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 既存の移動設定 */}
        {currentTransitions.map((transition) => {
          const targetScenario = availableScenarios.find(s => s.id === transition.to_scenario_id)
          return (
            <div key={transition.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{targetScenario?.name || '不明なシナリオ'}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemoveTransition(transition.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )
        })}

        {/* ABテスト設定 */}
        <div className="space-y-3 border-t pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch
                id="ab-test"
                checked={abTestEnabled}
                onCheckedChange={setAbTestEnabled}
              />
              <Label htmlFor="ab-test" className="flex items-center gap-2 text-sm">
                <TestTube className="h-4 w-4" />
                ABテスト
              </Label>
            </div>
            {abTestEnabled && (
              <div className="text-xs text-muted-foreground">
                移行率は設定数に応じて均等分配
              </div>
            )}
          </div>
          {abTestEnabled && (
            <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
              <strong>ABテストについて：</strong><br />
              設定したシナリオ遷移の数に応じて、ユーザーの移行率が均等に分配されます。<br />
              例：2つのシナリオ → 各50%、3つのシナリオ → 各33.3%
            </div>
          )}
        </div>

        {/* 新しい移動設定追加 */}
        {availableOptions.length > 0 && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Select value={selectedScenario} onValueChange={setSelectedScenario}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="移動先シナリオを選択" />
                </SelectTrigger>
                <SelectContent>
                  {availableOptions.map((scenario) => (
                    <SelectItem key={scenario.id} value={scenario.id}>
                      {scenario.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                onClick={handleAddTransition} 
                disabled={!selectedScenario}
                size="sm"
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                追加
              </Button>
            </div>

            {/* ABテスト用の追加設定 */}
            {abTestEnabled && (
              <div className="flex gap-2">
                <Select value={selectedAbScenario} onValueChange={setSelectedAbScenario}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="ABテスト用シナリオを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableOptions.filter(s => s.id !== selectedScenario).map((scenario) => (
                      <SelectItem key={scenario.id} value={scenario.id}>
                        {scenario.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  onClick={handleAddAbTransition} 
                  disabled={!selectedAbScenario}
                  size="sm"
                  className="gap-2"
                  variant="outline"
                >
                  <Plus className="h-4 w-4" />
                  AB追加
                </Button>
              </div>
            )}
          </div>
        )}

        {availableOptions.length === 0 && currentTransitions.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            移動可能なシナリオがありません
          </p>
        )}
      </CardContent>
    </Card>
  )
}
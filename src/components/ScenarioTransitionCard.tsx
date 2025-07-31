import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
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
  
  const currentTransitions = transitions.filter(t => t.from_scenario_id === currentScenario.id)
  const hasMultipleTransitions = currentTransitions.length >= 2
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

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <ArrowRight className="h-4 w-4" />
          別シナリオへの移動
        </CardTitle>
        {currentTransitions.length === 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            遷移シナリオを2個以上追加するとABテストが可能になります
          </p>
        )}
        {hasMultipleTransitions && (
          <p className="text-xs text-green-600 mt-2">
            <TestTube className="h-3 w-3 inline mr-1" />
            ABテスト有効：各シナリオに均等分配されます
          </p>
        )}
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
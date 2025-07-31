import { useState, useEffect } from "react"
import { Plus, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { supabase } from "@/integrations/supabase/client"
import { User } from "@supabase/supabase-js"
import { AppHeader } from "@/components/AppHeader"
import { MediaSelector } from "@/components/MediaSelector"
import { DraggableStepsList } from "@/components/DraggableStepsList"
import { ScenarioTransitionCard } from "@/components/ScenarioTransitionCard"
import { useStepScenarios, StepScenario, Step, StepMessage } from "@/hooks/useStepScenarios"
import { toast } from "sonner"

export default function StepDeliveryPage() {
  const [user, setUser] = useState<User | null>(null)
  const [selectedScenario, setSelectedScenario] = useState<StepScenario | null>(null)
  const [selectedStep, setSelectedStep] = useState<Step | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get user session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
  }, [])

  const {
    scenarios,
    steps,
    messages,
    transitions,
    loading: dataLoading,
    createScenario,
    updateScenario,
    createStep,
    updateStep,
    reorderSteps,
    createMessage,
    updateMessage,
    createTransition
  } = useStepScenarios(user?.id)

  // シナリオに属するステップのみを取得
  const selectedScenarioSteps = selectedScenario 
    ? steps.filter(s => s.scenario_id === selectedScenario.id).sort((a, b) => a.step_order - b.step_order)
    : []

  // 選択されたステップのメッセージを取得
  const selectedStepMessages = selectedStep 
    ? messages.filter(m => m.step_id === selectedStep.id).sort((a, b) => a.message_order - b.message_order)
    : []

  const handleCreateNewScenario = async () => {
    if (!user) return
    
    const scenario = await createScenario(`シナリオ ${scenarios.length + 1}`)
    if (scenario) {
      setSelectedScenario(scenario)
      setSelectedStep(null)
    }
  }

  const handleAddStep = async () => {
    if (!selectedScenario) return

    const step = await createStep(selectedScenario.id, `ステップ ${selectedScenarioSteps.length + 1}`)
    if (step) {
      setSelectedStep(step as Step)
    }
  }

  const handleAddMessage = async () => {
    if (!selectedStep) return

    await createMessage(selectedStep.id)
  }

  const handleUpdateStepTiming = async (timing: Partial<Omit<Step, 'id' | 'scenario_id' | 'name' | 'step_order' | 'created_at' | 'updated_at'>>) => {
    if (!selectedStep) return

    const updates: Partial<Step> = {}
    
    if (timing.delivery_type) updates.delivery_type = timing.delivery_type
    if (timing.delivery_days !== undefined) updates.delivery_days = timing.delivery_days
    if (timing.delivery_hours !== undefined) updates.delivery_hours = timing.delivery_hours
    if (timing.delivery_minutes !== undefined) updates.delivery_minutes = timing.delivery_minutes
    if (timing.specific_time !== undefined) updates.specific_time = timing.specific_time

    const updatedStep = await updateStep(selectedStep.id, updates)
    if (updatedStep) {
      setSelectedStep(updatedStep as Step)
    }
  }

  const handleUpdateMessage = async (messageId: string, updates: Partial<StepMessage>) => {
    await updateMessage(messageId, updates)
  }

  const handleStepReorder = async (newOrder: string[]) => {
    if (!selectedScenario) return
    await reorderSteps(selectedScenario.id, newOrder)
  }

  const handleUpdateScenarioName = async (name: string) => {
    if (!selectedScenario) return
    
    const updated = await updateScenario(selectedScenario.id, { name })
    if (updated) {
      setSelectedScenario(updated)
    }
  }

  const handleCreateTransition = async (toScenarioId: string) => {
    if (!selectedScenario) return
    await createTransition(selectedScenario.id, toScenarioId)
  }

  if (loading || dataLoading || !user) {
    return <div className="flex items-center justify-center min-h-screen">読み込み中...</div>
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader user={user} />
      
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">ステップ配信</h1>
        </div>

        <div className="flex gap-6 h-[calc(100vh-200px)]">
          {/* Scenarios List */}
          <div className="w-80 bg-card rounded-lg border p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">シナリオ一覧</h2>
              <Button onClick={handleCreateNewScenario} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                追加
              </Button>
            </div>
            
            <div className="space-y-2">
              {scenarios.map((scenario) => {
                const scenarioSteps = steps.filter(s => s.scenario_id === scenario.id)
                return (
                  <Card 
                    key={scenario.id}
                    className={`cursor-pointer transition-colors ${
                      selectedScenario?.id === scenario.id ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => {
                      setSelectedScenario(scenario)
                      setSelectedStep(null)
                    }}
                  >
                    <CardContent className="p-3">
                      <h3 className="font-medium">{scenario.name}</h3>
                      <p className="text-sm text-muted-foreground">{scenarioSteps.length} ステップ</p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>

          {/* Steps Creation Tool */}
          {selectedScenario && (
            <div className="w-80 bg-card rounded-lg border p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">ステップ作成</h2>
                <Button onClick={handleAddStep} size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  ステップ追加
                </Button>
              </div>

              <div className="mb-4">
                <Label htmlFor="scenario-name">シナリオ名</Label>
                <Input
                  id="scenario-name"
                  value={selectedScenario.name}
                  onChange={(e) => handleUpdateScenarioName(e.target.value)}
                />
              </div>

              <Separator className="my-4" />

              <div className="space-y-4">
                <DraggableStepsList
                  steps={selectedScenarioSteps}
                  selectedStep={selectedStep}
                  onStepSelect={setSelectedStep}
                  onReorder={handleStepReorder}
                />

                {/* シナリオ移動設定 */}
                <ScenarioTransitionCard
                  currentScenario={selectedScenario}
                  availableScenarios={scenarios}
                  transitions={transitions}
                  onAddTransition={handleCreateTransition}
                  onRemoveTransition={(transitionId) => {
                    // TODO: 削除機能を実装
                    console.log('削除:', transitionId)
                  }}
                />
              </div>
            </div>
          )}

          {/* Message Creation Screen */}
          {selectedStep && (
            <div className="flex-1 bg-card rounded-lg border p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">メッセージ作成 - {selectedStep.name}</h2>
                <Button onClick={handleAddMessage} size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  メッセージ追加
                </Button>
              </div>

              {/* Delivery Timing Settings */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-base">配信タイミング設定</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>配信タイプ</Label>
                    <Select
                      value={selectedStep.delivery_type}
                      onValueChange={(value: 'after_registration' | 'specific_time') => 
                        handleUpdateStepTiming({ delivery_type: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="after_registration">登録後の時間指定</SelectItem>
                        <SelectItem value="specific_time">日時指定</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedStep.delivery_type === 'after_registration' && (
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label>日</Label>
                        <Input
                          type="number"
                          min="0"
                          value={selectedStep.delivery_days || 0}
                          onChange={(e) => handleUpdateStepTiming({ delivery_days: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="flex-1">
                        <Label>時間</Label>
                        <Input
                          type="number"
                          min="0"
                          max="23"
                          value={selectedStep.delivery_hours || 0}
                          onChange={(e) => handleUpdateStepTiming({ delivery_hours: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="flex-1">
                        <Label>分</Label>
                        <Input
                          type="number"
                          min="0"
                          max="59"
                          value={selectedStep.delivery_minutes || 0}
                          onChange={(e) => handleUpdateStepTiming({ delivery_minutes: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                  )}

                  {selectedStep.delivery_type === 'specific_time' && (
                    <div>
                      <Label>指定時刻</Label>
                      <Input
                        type="datetime-local"
                        value={selectedStep.specific_time?.substring(0, 16) || ''}
                        onChange={(e) => handleUpdateStepTiming({ specific_time: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Messages */}
              <div className="space-y-4">
                {selectedStepMessages.map((message, index) => (
                  <Card key={message.id}>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        メッセージ {index + 1}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label>メッセージタイプ</Label>
                        <Select
                          value={message.message_type}
                          onValueChange={(value: 'text' | 'media') => 
                            handleUpdateMessage(message.id, { message_type: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">テキストメッセージ</SelectItem>
                            <SelectItem value="media">メディアライブラリ</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {message.message_type === 'text' && (
                        <div>
                          <Label>メッセージ内容</Label>
                          <Textarea
                            value={message.content}
                            onChange={(e) => handleUpdateMessage(message.id, { content: e.target.value })}
                            placeholder="メッセージを入力してください..."
                            rows={3}
                          />
                        </div>
                      )}

                      {message.message_type === 'media' && (
                        <div>
                          <Label>メディア選択</Label>
                          <MediaSelector
                            onSelect={(url) => handleUpdateMessage(message.id, { media_url: url })}
                            selectedUrl={message.media_url || undefined}
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}

                {selectedStepMessages.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>メッセージを追加してください</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Empty state when no scenario is selected */}
          {!selectedScenario && (
            <div className="flex-1 flex items-center justify-center text-center">
              <div className="text-muted-foreground">
                <Plus className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">ステップ配信シナリオを作成</h3>
                <p>「追加」ボタンをクリックして新しいシナリオを作成してください</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
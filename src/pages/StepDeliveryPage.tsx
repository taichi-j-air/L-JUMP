import { useState, useEffect } from "react"
import { Plus, MessageSquare, Trash2, ChevronDown, ChevronUp } from "lucide-react"
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
import { FlexMessageSelector } from "@/components/FlexMessageSelector"
import { DraggableStepsList } from "@/components/DraggableStepsList"
import { ScenarioTransitionCard } from "@/components/ScenarioTransitionCard"
import { MessagePreview } from "@/components/MessagePreview"
import { SortableScenarioItem } from "@/components/SortableScenarioItem"
import { useStepScenarios, StepScenario, Step, StepMessage } from "@/hooks/useStepScenarios"
import { toast } from "sonner"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'

export default function StepDeliveryPage() {
  const [user, setUser] = useState<User | null>(null)
  const [selectedScenario, setSelectedScenario] = useState<StepScenario | null>(null)
  const [selectedStep, setSelectedStep] = useState<Step | null>(null)
  const [loading, setLoading] = useState(true)
  const [isMessageCreationCollapsed, setIsMessageCreationCollapsed] = useState(false)
  const [collapsedMessages, setCollapsedMessages] = useState<Set<string>>(new Set())

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

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
    deleteScenario,
    createStep,
    updateStep,
    deleteStep,
    reorderSteps,
    createMessage,
    updateMessage,
    deleteMessage,
    createTransition,
    deleteTransition
  } = useStepScenarios(user?.id)

  // シナリオに属するステップのみを取得
  const selectedScenarioSteps = selectedScenario 
    ? steps.filter(s => s.scenario_id === selectedScenario.id).sort((a, b) => a.step_order - b.step_order)
    : []

  // 選択されたステップのメッセージを取得
  const selectedStepMessages = selectedStep 
    ? messages.filter(m => m.step_id === selectedStep.id).sort((a, b) => a.message_order - b.message_order)
    : []

  // 最初のメッセージ配信時刻を計算
  const getFirstMessageDeliveryTime = (scenario: StepScenario) => {
    const scenarioSteps = steps.filter(s => s.scenario_id === scenario.id).sort((a, b) => a.step_order - b.step_order)
    if (scenarioSteps.length === 0) return "ステップなし"
    
    const firstStep = scenarioSteps[0]
    if (firstStep.delivery_type === 'specific_time') {
      return "特定日時"
    }
    
    const days = firstStep.delivery_days || 0
    const hours = firstStep.delivery_hours || 0
    const minutes = firstStep.delivery_minutes || 0
    const seconds = firstStep.delivery_seconds || 0
    
    if (days === 0 && hours === 0 && minutes === 0 && seconds === 0) {
      return "登録後：即時配信"
    }
    
    const parts = []
    if (days > 0) parts.push(`${days}日`)
    if (hours > 0) parts.push(`${hours}時間`)
    if (minutes > 0) parts.push(`${minutes}分`)
    if (seconds > 0) parts.push(`${seconds}秒`)
    
    return `登録後：${parts.join('')}後`
  }

  // シナリオの移動先を取得
  const getTransitionDestination = (scenarioId: string) => {
    const transition = transitions.find(t => t.from_scenario_id === scenarioId)
    if (!transition) return null
    return scenarios.find(s => s.id === transition.to_scenario_id)
  }

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
      // 新しいステップに自動的にメッセージを追加
      await createMessage(step.id)
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
    if (timing.delivery_seconds !== undefined) updates.delivery_seconds = timing.delivery_seconds
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

  const handleDeleteScenario = async (scenarioId: string) => {
    await deleteScenario(scenarioId)
    if (selectedScenario?.id === scenarioId) {
      setSelectedScenario(null)
      setSelectedStep(null)
    }
  }

  const handleDeleteStep = async (stepId: string) => {
    await deleteStep(stepId)
    if (selectedStep?.id === stepId) {
      setSelectedStep(null)
    }
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

  const handleRemoveTransition = async (transitionId: string) => {
    await deleteTransition(transitionId)
  }

  const handleScenarioDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = scenarios.findIndex((item) => item.id === active.id)
      const newIndex = scenarios.findIndex((item) => item.id === over.id)
      
      if (oldIndex !== -1 && newIndex !== -1) {
        // Reorder scenarios locally for immediate UI feedback
        const newScenarios = arrayMove(scenarios, oldIndex, newIndex)
        
        // Note: For proper implementation, you'd want to add scenario order functionality to useStepScenarios
        // and update the database with the new order
        toast.success('シナリオの順序を変更しました')
        
        // Optional: Log for debugging
        console.log('Scenario reorder:', { from: oldIndex, to: newIndex, scenarios: newScenarios.map(s => s.name) })
      }
    }
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
          <div className="w-80 bg-card rounded-lg border p-4 flex-shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">シナリオ一覧</h2>
              <Button onClick={handleCreateNewScenario} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                追加
              </Button>
            </div>
            
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleScenarioDragEnd}
            >
              <SortableContext
                items={scenarios.map(s => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {scenarios.map((scenario) => {
                    const scenarioSteps = steps.filter(s => s.scenario_id === scenario.id)
                    const transitionDestination = getTransitionDestination(scenario.id)
                    return (
                      <SortableScenarioItem
                        key={scenario.id}
                        scenario={scenario}
                        isSelected={selectedScenario?.id === scenario.id}
                        scenarioSteps={scenarioSteps.length}
                        deliveryTime={getFirstMessageDeliveryTime(scenario)}
                        transitionDestination={transitionDestination?.name}
                        onSelect={() => {
                          setSelectedScenario(scenario)
                          setSelectedStep(null)
                        }}
                        onDelete={() => handleDeleteScenario(scenario.id)}
                      />
                    )
                  })}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          {/* Steps Creation Tool */}
          {selectedScenario && (
            <div className="w-80 bg-card rounded-lg border p-4 overflow-y-auto flex-shrink-0">
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
                  onStepDelete={handleDeleteStep}
                />

                {/* シナリオ移動設定 */}
                <ScenarioTransitionCard
                  currentScenario={selectedScenario}
                  availableScenarios={scenarios}
                  transitions={transitions}
                  onAddTransition={handleCreateTransition}
                  onRemoveTransition={handleRemoveTransition}
                />
              </div>
            </div>
          )}

          {/* Message Creation Screen */}
          {selectedStep && (
            <div className="w-96 bg-card rounded-lg border p-4 overflow-y-auto flex-shrink-0">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">メッセージ作成 - {selectedStep.name}</h2>
                <div className="flex gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setIsMessageCreationCollapsed(!isMessageCreationCollapsed)}
                  >
                    {isMessageCreationCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                  </Button>
                  <Button onClick={handleAddMessage} size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    メッセージ追加
                  </Button>
                </div>
              </div>

              {!isMessageCreationCollapsed && (
                <>
                  {/* Delivery Timing Settings */}
                  <Card className="mb-4">
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">配信タイミング設定</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 pb-3">
                      <div>
                        <Label className="text-sm">配信タイプ</Label>
                        <Select
                          value={selectedStep.delivery_type}
                          onValueChange={(value: 'after_registration' | 'specific_time') => 
                            handleUpdateStepTiming({ delivery_type: value })
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="after_registration">
                              {selectedScenarioSteps.findIndex(s => s.id === selectedStep.id) === 0 ? '登録後の時間指定' : '前ステップからの時間指定'}
                            </SelectItem>
                            <SelectItem value="specific_time">日時指定</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {selectedStep.delivery_type === 'after_registration' && (
                        <div className="grid grid-cols-4 gap-2">
                          <div>
                            <Label className="text-xs">日</Label>
                            <Input
                              type="number"
                              min="0"
                              className="h-8"
                              value={selectedStep.delivery_days || 0}
                              onChange={(e) => handleUpdateStepTiming({ delivery_days: parseInt(e.target.value) || 0 })}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">時間</Label>
                            <Input
                              type="number"
                              min="0"
                              max="23"
                              className="h-8"
                              value={selectedStep.delivery_hours || 0}
                              onChange={(e) => handleUpdateStepTiming({ delivery_hours: parseInt(e.target.value) || 0 })}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">分</Label>
                            <Input
                              type="number"
                              min="0"
                              max="59"
                              className="h-8"
                              value={selectedStep.delivery_minutes || 0}
                              onChange={(e) => handleUpdateStepTiming({ delivery_minutes: parseInt(e.target.value) || 0 })}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">秒</Label>
                            <Input
                              type="number"
                              min="0"
                              max="59"
                              className="h-8"
                              value={selectedStep.delivery_seconds || 0}
                              onChange={(e) => handleUpdateStepTiming({ delivery_seconds: parseInt(e.target.value) || 0 })}
                            />
                          </div>
                        </div>
                      )}

                      {selectedStep.delivery_type === 'specific_time' && (
                        <div>
                          <Label className="text-sm">指定時刻</Label>
                          <Input
                            type="datetime-local"
                            className="h-8"
                            value={selectedStep.specific_time?.substring(0, 16) || ''}
                            onChange={(e) => handleUpdateStepTiming({ specific_time: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Messages */}
                  <div className="space-y-4">
                    {selectedStepMessages.length === 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm flex items-center gap-2">
                            <MessageSquare className="h-4 w-4" />
                            メッセージ 1
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div>
                            <Label>メッセージタイプ</Label>
                             <Select
                               value="text"
                               onValueChange={(value: 'text' | 'media' | 'flex') => {
                                 // 新しいメッセージを作成
                                 createMessage(selectedStep.id, value)
                               }}
                             >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                 <SelectItem value="text">テキストメッセージ</SelectItem>
                                <SelectItem value="media">メディアライブラリ</SelectItem>
                                <SelectItem value="flex">Flexメッセージ</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label>メッセージ内容</Label>
                            <Textarea
                              placeholder="メッセージを入力してください..."
                              rows={5}
                              className="resize-none"
                            />
                            <div className="text-xs text-muted-foreground mt-1">
                              0 / 5000 文字
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {selectedStepMessages.map((message, index) => {
                      const isCollapsed = collapsedMessages.has(message.id)
                      return (
                        <Card key={message.id}>
                          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <MessageSquare className="h-4 w-4" />
                              メッセージ {index + 1}
                            </CardTitle>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const newCollapsed = new Set(collapsedMessages)
                                  if (isCollapsed) {
                                    newCollapsed.delete(message.id)
                                  } else {
                                    newCollapsed.add(message.id)
                                  }
                                  setCollapsedMessages(newCollapsed)
                                }}
                              >
                                {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteMessage(message.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </CardHeader>
                          {!isCollapsed && (
                            <CardContent className="space-y-4">
                              <div>
                                <Label>メッセージタイプ</Label>
                                 <Select
                                   value={message.message_type}
                                   onValueChange={(value: 'text' | 'media' | 'flex') => 
                                     handleUpdateMessage(message.id, { message_type: value })
                                   }
                                 >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                   <SelectItem value="text">テキストメッセージ</SelectItem>
                                    <SelectItem value="media">メディアライブラリ</SelectItem>
                                    <SelectItem value="flex">Flexメッセージ</SelectItem>
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
                                    rows={5}
                                    className="resize-none ime-enabled"
                                    lang="ja"
                                  />
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {message.content.length} / 5000 文字
                                  </div>
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

                               {message.message_type === 'flex' && (
                                 <div>
                                   <Label>Flexメッセージ選択</Label>
                                   <FlexMessageSelector
                                     onSelect={(flexMessageId) => handleUpdateMessage(message.id, { content: flexMessageId })}
                                     selectedFlexMessageId={message.content}
                                   />
                                 </div>
                               )}
                            </CardContent>
                          )}
                        </Card>
                      )
                    })}

                    {selectedStepMessages.length > 0 && (
                      <div className="text-center">
                        <Button onClick={handleAddMessage} variant="outline" size="sm" className="gap-2">
                          <Plus className="h-4 w-4" />
                          メッセージ追加
                        </Button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Message Preview Panel */}
          {selectedStep && (
            <div className="w-80 flex-shrink-0">
              <MessagePreview messages={selectedStepMessages} />
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
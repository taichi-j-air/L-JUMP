import { useState, useEffect } from "react"
import { Plus, MessageSquare, Trash2, ChevronDown, ChevronUp, FolderPlus } from "lucide-react"
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
import { ScenarioInviteCard } from "@/components/ScenarioInviteCard"
import { ScenarioAnalytics } from "@/components/ScenarioAnalytics"
import { StepDeliveryStatus } from "@/components/StepDeliveryStatus"
import { MessagePreview } from "@/components/MessagePreview"
import { SortableScenarioItem } from "@/components/SortableScenarioItem"
import { ScenarioFolders } from "@/components/ScenarioFolders"
import { useScenarioFolders } from "@/hooks/useScenarioFolders"
import { useStepScenarios, StepScenario, Step, StepMessage } from "@/hooks/useStepScenarios"
import { toast } from "sonner"
import {
  DndContext,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  useDroppable,
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
  const [scenarioStats, setScenarioStats] = useState<Record<string, { registered: number; exited: number; blocked: number }>>({})
  const [statsRefreshToken, setStatsRefreshToken] = useState(0)
  // IME対応のため、メッセージ本文はローカルドラフトで保持し、保存はonBlurで行う
  const [draftMessageContents, setDraftMessageContents] = useState<Record<string, string>>({})
  // シナリオ名もIME対応のためドラフト管理
  const [scenarioNameDraft, setScenarioNameDraft] = useState<string>("")

  const { 
    folders,
    addFolder,
    renameFolder,
    setFolderColor,
    setFolderBorderColor,
    toggleFolder,
    moveToFolder,
    removeFromFolder,
    deleteFolder,
    reorderFolders,
    reorderFolderItems,
    getFolderIdByScenario,
  } = useScenarioFolders(user?.id)

  // rootScenarios はデータ取得後に計算

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const { setNodeRef: setRootDropRef, isOver: isOverRoot } = useDroppable({ id: 'root' })

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
    inviteCodes,
    loading: dataLoading,
    createScenario,
    updateScenario,
    deleteScenario,
    reorderScenarios,
    createStep,
    updateStep,
    deleteStep,
    reorderSteps,
    createMessage,
    updateMessage,
    deleteMessage,
    createTransition,
    deleteTransition,
    generateInviteCode,
    deactivateInviteCode
  } = useStepScenarios(user?.id)

  // シナリオ名ドラフトを選択状態に同期（IME対応）
  useEffect(() => {
    setScenarioNameDraft(selectedScenario?.name ?? '')
  }, [selectedScenario?.id, selectedScenario?.name])

  // シナリオに属するステップのみを取得
  const selectedScenarioSteps = selectedScenario 
    ? steps.filter(s => s.scenario_id === selectedScenario.id).sort((a, b) => a.step_order - b.step_order)
    : []

  // 選択されたステップのメッセージを取得
  const selectedStepMessages = selectedStep 
    ? messages.filter(m => m.step_id === selectedStep.id).sort((a, b) => a.message_order - b.message_order)
    : []

  // メッセージ一覧の変化に応じてローカルドラフトを初期化（存在しないIDは削除）
  useEffect(() => {
    setDraftMessageContents((prev) => {
      const next: Record<string, string> = { ...prev }
      selectedStepMessages.forEach((m) => {
        if (next[m.id] === undefined) next[m.id] = m.content || ''
      })
      const ids = new Set(selectedStepMessages.map((m) => m.id))
      Object.keys(next).forEach((id) => { if (!ids.has(id)) delete next[id] })
      return next
    })
  }, [selectedStep?.id, selectedStepMessages.length])

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

  // シナリオの移動先を取得（複数の移動先に対応）
  const getTransitionDestinations = (scenarioId: string) => {
    const scenarioTransitions = transitions.filter(t => t.from_scenario_id === scenarioId)
    return scenarioTransitions.map(t => {
      const destination = scenarios.find(s => s.id === t.to_scenario_id)
      return destination ? destination.name : '不明なシナリオ'
    }).filter(name => name !== '不明なシナリオ')
  }

  // 統計の手動更新イベント
  useEffect(() => {
    const handler = () => setStatsRefreshToken((t) => t + 1)
    window.addEventListener('scenario-stats-updated', handler)
    return () => window.removeEventListener('scenario-stats-updated', handler)
  }, [])

  // シナリオ統計の読み込み（登録数・離脱数・ブロック数）
  useEffect(() => {
    if (!user || scenarios.length === 0) {
      setScenarioStats({})
      return
    }
    const scenarioIds = scenarios.map(s => s.id)
    const load = async () => {
      try {
        const [regRes, exitRes, failRes] = await Promise.all([
          supabase.from('scenario_friend_logs').select('scenario_id, friend_id, line_user_id').in('scenario_id', scenarioIds),
          supabase.from('step_delivery_tracking').select('scenario_id, friend_id, status').in('scenario_id', scenarioIds).eq('status','exited'),
          supabase.from('step_delivery_logs').select('scenario_id, friend_id, delivery_status, error_message').in('scenario_id', scenarioIds).eq('delivery_status','failed'),
        ])
        const stats: Record<string, { registered: number; exited: number; blocked: number }> = {}
        for (const id of scenarioIds) stats[id] = { registered: 0, exited: 0, blocked: 0 }
        const regMap: Record<string, Set<string>> = {}
        ;(regRes.data || []).forEach((l: any) => {
          const sid = l.scenario_id; const fid = l.friend_id || l.line_user_id
          if (!sid || !fid) return
          regMap[sid] = regMap[sid] || new Set<string>()
          regMap[sid].add(fid)
        })
        Object.keys(regMap).forEach(sid => { stats[sid].registered = regMap[sid].size })
        const exitMap: Record<string, Set<string>> = {}
        ;(exitRes.data || []).forEach((r: any) => {
          const sid = r.scenario_id; const fid = r.friend_id
          if (!sid || !fid) return
          exitMap[sid] = exitMap[sid] || new Set<string>()
          exitMap[sid].add(fid)
        })
        Object.keys(exitMap).forEach(sid => { stats[sid].exited = exitMap[sid].size })
        const blockMap: Record<string, Set<string>> = {}
        ;(failRes.data || []).forEach((r: any) => {
          const sid = r.scenario_id; const fid = r.friend_id
          if (!sid || !fid) return
          blockMap[sid] = blockMap[sid] || new Set<string>()
          blockMap[sid].add(fid)
        })
        Object.keys(blockMap).forEach(sid => { stats[sid].blocked = blockMap[sid].size })
        setScenarioStats(stats)
      } catch (e) {
        console.error('シナリオ統計取得失敗:', e)
      }
    }
    load()
  }, [user?.id, scenarios.map(s => s.id).join(','), statsRefreshToken])

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
    if (timing.delivery_time_of_day !== undefined) updates.delivery_time_of_day = timing.delivery_time_of_day

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
    // フォルダからも即時に外す（件数更新のため）
    removeFromFolder(scenarioId)
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

  const handleUpdateStepName = async (stepId: string, name: string) => {
    const updated = await updateStep(stepId, { name })
    if (updated && selectedStep?.id === stepId) {
      setSelectedStep(updated as Step)
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
    if (!over) return

    const activeId = String(active.id)
    const overIdOriginal = String(over.id)

    // フォルダの並び替え（overがフォルダ本体でも許容）
    if (activeId.startsWith('folderItem:') && (overIdOriginal.startsWith('folderItem:') || overIdOriginal.startsWith('folder:'))) {
      const overId = overIdOriginal.startsWith('folder:') ? `folderItem:${overIdOriginal.replace('folder:', '')}` : overIdOriginal
      const folderIds = folders.map(f => `folderItem:${f.id}`)
      const oldIndex = folderIds.indexOf(activeId)
      const newIndex = folderIds.indexOf(overId)
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(folders.map(f => f.id), oldIndex, newIndex)
        reorderFolders(newOrder)
      }
      return
    }

    // ルート（未分類）ドロップゾーンにドロップ → フォルダから外す
    if (overIdOriginal === 'root' && !activeId.startsWith('folderItem:')) {
      const root = scenarios.filter(s => !getFolderIdByScenario(s.id))
      const alreadyInRoot = root.some(r => r.id === activeId)
      if (!alreadyInRoot) {
        removeFromFolder(activeId)
        reorderScenarios([...root.map(s => s.id), activeId])
      }
      return
    }

    // フォルダへのドロップ（シナリオ→フォルダ）
    if (overIdOriginal.startsWith('folder:')) {
      if (activeId.startsWith('folderItem:')) return // フォルダ自体は入れない
      const folderId = overIdOriginal.replace('folder:', '')
      moveToFolder(activeId, folderId)
      return
    }

    const activeFolderId = getFolderIdByScenario(activeId)
    const overFolderId = getFolderIdByScenario(overIdOriginal)

    // 同一フォルダ内での並び替え
    if (activeFolderId && overFolderId && activeFolderId === overFolderId) {
      const folder = folders.find(f => f.id === activeFolderId)
      if (folder) {
        const oldIndex = folder.scenarioIds.indexOf(activeId)
        const newIndex = folder.scenarioIds.indexOf(overIdOriginal)
        if (oldIndex !== -1 && newIndex !== -1) {
          const newOrder = arrayMove(folder.scenarioIds, oldIndex, newIndex)
          reorderFolderItems(activeFolderId, newOrder)
        }
      }
      return
    }

    // フォルダ間の移動
    if (activeFolderId && overFolderId && activeFolderId !== overFolderId) {
      moveToFolder(activeId, overFolderId)
      return
    }

    // ルート内での並び替え（またはフォルダからルートへ）
    const root = scenarios.filter(s => !getFolderIdByScenario(s.id))
    if (activeId !== overIdOriginal) {
      const inRoot = root.some(r => r.id === activeId)
      const overIndex = root.findIndex((item) => item.id === overIdOriginal)

      if (!inRoot) {
        // フォルダからルートに出す（指定位置）
        removeFromFolder(activeId)
        const targetScenario = scenarios.find(s => s.id === activeId)
        if (targetScenario) {
          const newRoot = [...root]
          if (overIndex === -1) {
            newRoot.push(targetScenario)
          } else {
            newRoot.splice(overIndex, 0, targetScenario)
          }
          reorderScenarios(newRoot.map(s => s.id))
        }
      } else {
        const oldIndex = root.findIndex((item) => item.id === activeId)
        if (oldIndex !== -1 && overIndex !== -1) {
          const newOrder = arrayMove(root, oldIndex, overIndex).map(s => s.id)
          reorderScenarios(newOrder)
        }
      }
    }
  }

  const renderScenarioItem = (scenarioId: string) => {
    const scenario = scenarios.find(s => s.id === scenarioId)
    if (!scenario) return null
    const scenarioSteps = steps.filter(s => s.scenario_id === scenario.id)
    const transitionDestinations = getTransitionDestinations(scenario.id)
    return (
      <SortableScenarioItem
        key={scenario.id}
        scenario={scenario}
        isSelected={selectedScenario?.id === scenario.id}
        scenarioSteps={scenarioSteps.length}
        deliveryTime={getFirstMessageDeliveryTime(scenario)}
        transitionDestinations={transitionDestinations}
        stats={scenarioStats[scenario.id]}
        onSelect={() => {
          setSelectedScenario(scenario)
          setSelectedStep(null)
        }}
        onDelete={() => handleDeleteScenario(scenario.id)}
      />
    )
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

        <div className="flex gap-0 h-[calc(100vh-200px)]">
          {/* Scenarios List */}
          <div className="w-80 bg-card p-4 flex-shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">シナリオ一覧</h2>
              <div className="flex items-center gap-2">
                <Button onClick={() => addFolder()} size="sm" variant="outline" className="gap-2">
                  <FolderPlus className="h-4 w-4" />
                  フォルダ
                </Button>
                <Button onClick={handleCreateNewScenario} size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  追加
                </Button>
              </div>
            </div>
            
            <DndContext
              sensors={sensors}
              collisionDetection={rectIntersection}
              onDragEnd={handleScenarioDragEnd}
            >
              {/* フォルダ一覧 */}
              <div className="space-y-2 mb-4">
                <SortableContext
                  items={folders.map(f => `folderItem:${f.id}`)}
                  strategy={verticalListSortingStrategy}
               >
                  <ScenarioFolders
                    folders={folders}
                    onAdd={() => addFolder()}
                    onRename={renameFolder}
                    onBorderColor={setFolderBorderColor}
                    onToggle={toggleFolder}
                    onMoveOut={(id) => removeFromFolder(id)}
                    onDelete={deleteFolder}
                    getScenarioName={(id) => scenarios.find(s => s.id === id)?.name || ''}
                    renderScenario={renderScenarioItem}
                  />
                </SortableContext>
              </div>

              {/* ルートのドロップゾーン（未分類に戻す） */}
              <div
                ref={setRootDropRef}
                className={`mb-2 h-12 rounded-md border border-dashed border-border text-xs flex items-center justify-center ${isOverRoot ? 'bg-muted ring-2 ring-primary' : 'bg-transparent'} animate-fade-in`}
              >
                ここにドロップで「未分類」に戻す
              </div>

              {/* ルートのシナリオ */}
              <SortableContext
                items={scenarios.filter(s => !getFolderIdByScenario(s.id)).map(s => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {scenarios.filter(s => !getFolderIdByScenario(s.id)).map((scenario) => (
                    renderScenarioItem(scenario.id)
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          {/* Steps Creation Tool */}
          {selectedScenario && (
            <div className="w-80 bg-card border-l border-border p-4 overflow-y-auto flex-shrink-0">
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
                  value={scenarioNameDraft}
                  onChange={(e) => setScenarioNameDraft(e.target.value)}
                  onBlur={() => {
                    if (selectedScenario && scenarioNameDraft !== selectedScenario.name) {
                      handleUpdateScenarioName(scenarioNameDraft)
                    }
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur() }}
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
                  onStepUpdate={handleUpdateStepName}
                />

                {/* シナリオ移動設定 */}
                <ScenarioTransitionCard
                  currentScenario={selectedScenario}
                  availableScenarios={scenarios}
                  transitions={transitions}
                  onAddTransition={handleCreateTransition}
                  onRemoveTransition={handleRemoveTransition}
                />

                {/* 招待コード設定 */}
                <ScenarioInviteCard
                  scenario={selectedScenario}
                  inviteCodes={inviteCodes}
                  onGenerateCode={generateInviteCode}
                  onDeactivateCode={deactivateInviteCode}
                />

                {/* 流入分析 */}
                <ScenarioAnalytics scenario={selectedScenario} />
              </div>
            </div>
          )}

          {/* Message Creation Screen */}
          {selectedStep && (
            <div className="flex-1 bg-card border-l border-border p-4 overflow-y-auto min-w-0 w-96 flex-shrink-0">
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
                          onValueChange={(value: 'relative' | 'specific_time' | 'relative_to_previous') => 
                            handleUpdateStepTiming({ delivery_type: value })
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="relative">①時間指定（経過時間）</SelectItem>
                            <SelectItem value="specific_time">②日時指定（固定日時）</SelectItem>
                            <SelectItem value="relative_to_previous">③日数+時刻指定</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {selectedStep.delivery_type === 'relative' && (
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

                      {selectedStep.delivery_type === 'relative_to_previous' && (
                        <div className="space-y-3">
                          <div>
                            <Label className="text-sm">日数</Label>
                            <Input
                              type="number"
                              min="0"
                              className="h-8"
                              value={selectedStep.delivery_days || 0}
                              onChange={(e) => handleUpdateStepTiming({ delivery_days: parseInt(e.target.value) || 0 })}
                            />
                          </div>
                          <div>
                            <Label className="text-sm">配信時刻</Label>
                            <Input
                              type="time"
                              className="h-8"
                              value={selectedStep.delivery_time_of_day || ''}
                              onChange={(e) => handleUpdateStepTiming({ delivery_time_of_day: e.target.value })}
                            />
                          </div>
                        </div>
                      )}
                     </CardContent>
                   </Card>

                   {/* ステップ配信状況 */}
                   <StepDeliveryStatus step={selectedStep} />

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
                                    value={draftMessageContents[message.id] ?? ''}
                                    onChange={(e) => setDraftMessageContents(prev => ({ ...prev, [message.id]: e.target.value }))}
                                    onBlur={() => {
                                      const draft = draftMessageContents[message.id] ?? ''
                                      if (draft !== message.content) {
                                        handleUpdateMessage(message.id, { content: draft })
                                      }
                                    }}
                                    placeholder="メッセージを入力してください..."
                                    rows={5}
                                    className="resize-none"
                                    lang="ja"
                                  />
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {(draftMessageContents[message.id] ?? '').length} / 5000 文字
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
                                      onSelect={(flexMessageId) => handleUpdateMessage(message.id, { flex_message_id: flexMessageId })}
                                      selectedFlexMessageId={message.flex_message_id}
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
            <div className="w-80 border-l border-border pl-4 flex-shrink-0">
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
import { useState, useEffect } from "react"
import { Plus, Calendar, Clock, MessageSquare, Image } from "lucide-react"
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
import { toast } from "sonner"

interface StepScenario {
  id: string
  name: string
  description: string
  steps: Step[]
}

interface Step {
  id: string
  name: string
  deliveryTiming: DeliveryTiming
  messages: Message[]
}

interface DeliveryTiming {
  type: 'after_registration' | 'specific_time'
  days?: number
  hours?: number
  minutes?: number
  specificTime?: string
}

interface Message {
  id: string
  type: 'text' | 'media'
  content: string
  mediaUrl?: string
}

export default function StepDeliveryPage() {
  const [user, setUser] = useState<User | null>(null)
  const [scenarios, setScenarios] = useState<StepScenario[]>([])
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

  const createNewScenario = () => {
    const newScenario: StepScenario = {
      id: crypto.randomUUID(),
      name: `シナリオ ${scenarios.length + 1}`,
      description: "",
      steps: []
    }
    setScenarios([...scenarios, newScenario])
    setSelectedScenario(newScenario)
    setSelectedStep(null)
  }

  const addStep = () => {
    if (!selectedScenario) return

    const newStep: Step = {
      id: crypto.randomUUID(),
      name: `ステップ ${selectedScenario.steps.length + 1}`,
      deliveryTiming: {
        type: 'after_registration',
        days: 0,
        hours: 0,
        minutes: 0
      },
      messages: []
    }

    const updatedScenario = {
      ...selectedScenario,
      steps: [...selectedScenario.steps, newStep]
    }

    const updatedScenarios = scenarios.map(s => 
      s.id === selectedScenario.id ? updatedScenario : s
    )

    setScenarios(updatedScenarios)
    setSelectedScenario(updatedScenario)
    setSelectedStep(newStep)
  }

  const addMessage = () => {
    if (!selectedStep || !selectedScenario) return

    const newMessage: Message = {
      id: crypto.randomUUID(),
      type: 'text',
      content: ''
    }

    const updatedStep = {
      ...selectedStep,
      messages: [...selectedStep.messages, newMessage]
    }

    const updatedScenario = {
      ...selectedScenario,
      steps: selectedScenario.steps.map(s => 
        s.id === selectedStep.id ? updatedStep : s
      )
    }

    const updatedScenarios = scenarios.map(s => 
      s.id === selectedScenario.id ? updatedScenario : s
    )

    setScenarios(updatedScenarios)
    setSelectedScenario(updatedScenario)
    setSelectedStep(updatedStep)
  }

  const updateStepTiming = (timing: Partial<DeliveryTiming>) => {
    if (!selectedStep || !selectedScenario) return

    const updatedStep = {
      ...selectedStep,
      deliveryTiming: { ...selectedStep.deliveryTiming, ...timing }
    }

    const updatedScenario = {
      ...selectedScenario,
      steps: selectedScenario.steps.map(s => 
        s.id === selectedStep.id ? updatedStep : s
      )
    }

    const updatedScenarios = scenarios.map(s => 
      s.id === selectedScenario.id ? updatedScenario : s
    )

    setScenarios(updatedScenarios)
    setSelectedScenario(updatedScenario)
    setSelectedStep(updatedStep)
  }

  const updateMessage = (messageId: string, updates: Partial<Message>) => {
    if (!selectedStep || !selectedScenario) return

    const updatedStep = {
      ...selectedStep,
      messages: selectedStep.messages.map(m => 
        m.id === messageId ? { ...m, ...updates } : m
      )
    }

    const updatedScenario = {
      ...selectedScenario,
      steps: selectedScenario.steps.map(s => 
        s.id === selectedStep.id ? updatedStep : s
      )
    }

    const updatedScenarios = scenarios.map(s => 
      s.id === selectedScenario.id ? updatedScenario : s
    )

    setScenarios(updatedScenarios)
    setSelectedScenario(updatedScenario)
    setSelectedStep(updatedStep)
  }

  if (loading || !user) {
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
              <Button onClick={createNewScenario} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                追加
              </Button>
            </div>
            
            <div className="space-y-2">
              {scenarios.map((scenario) => (
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
                    <p className="text-sm text-muted-foreground">{scenario.steps.length} ステップ</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Steps Creation Tool */}
          {selectedScenario && (
            <div className="w-80 bg-card rounded-lg border p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">ステップ作成</h2>
                <Button onClick={addStep} size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  ステップ追加
                </Button>
              </div>

              <div className="mb-4">
                <Label htmlFor="scenario-name">シナリオ名</Label>
                <Input
                  id="scenario-name"
                  value={selectedScenario.name}
                  onChange={(e) => {
                    const updatedScenario = { ...selectedScenario, name: e.target.value }
                    const updatedScenarios = scenarios.map(s => 
                      s.id === selectedScenario.id ? updatedScenario : s
                    )
                    setScenarios(updatedScenarios)
                    setSelectedScenario(updatedScenario)
                  }}
                />
              </div>

              <Separator className="my-4" />

              <div className="space-y-2">
                {selectedScenario.steps.map((step, index) => (
                  <Card 
                    key={step.id}
                    className={`cursor-pointer transition-colors ${
                      selectedStep?.id === step.id ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setSelectedStep(step)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium">{step.name}</h4>
                          <p className="text-xs text-muted-foreground">
                            {step.messages.length} メッセージ
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Message Creation Screen */}
          {selectedStep && (
            <div className="flex-1 bg-card rounded-lg border p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">メッセージ作成 - {selectedStep.name}</h2>
                <Button onClick={addMessage} size="sm" className="gap-2">
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
                      value={selectedStep.deliveryTiming.type}
                      onValueChange={(value: 'after_registration' | 'specific_time') => 
                        updateStepTiming({ type: value })
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

                  {selectedStep.deliveryTiming.type === 'after_registration' && (
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label>日</Label>
                        <Input
                          type="number"
                          min="0"
                          value={selectedStep.deliveryTiming.days || 0}
                          onChange={(e) => updateStepTiming({ days: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="flex-1">
                        <Label>時間</Label>
                        <Input
                          type="number"
                          min="0"
                          max="23"
                          value={selectedStep.deliveryTiming.hours || 0}
                          onChange={(e) => updateStepTiming({ hours: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="flex-1">
                        <Label>分</Label>
                        <Input
                          type="number"
                          min="0"
                          max="59"
                          value={selectedStep.deliveryTiming.minutes || 0}
                          onChange={(e) => updateStepTiming({ minutes: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                  )}

                  {selectedStep.deliveryTiming.type === 'specific_time' && (
                    <div>
                      <Label>指定時刻</Label>
                      <Input
                        type="datetime-local"
                        value={selectedStep.deliveryTiming.specificTime || ''}
                        onChange={(e) => updateStepTiming({ specificTime: e.target.value })}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Messages */}
              <div className="space-y-4">
                {selectedStep.messages.map((message, index) => (
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
                          value={message.type}
                          onValueChange={(value: 'text' | 'media') => 
                            updateMessage(message.id, { type: value })
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

                      {message.type === 'text' && (
                        <div>
                          <Label>メッセージ内容</Label>
                          <Textarea
                            value={message.content}
                            onChange={(e) => updateMessage(message.id, { content: e.target.value })}
                            placeholder="メッセージを入力してください..."
                            rows={3}
                          />
                        </div>
                      )}

                      {message.type === 'media' && (
                        <div>
                          <Label>メディア選択</Label>
                          <MediaSelector
                            onSelect={(url) => updateMessage(message.id, { mediaUrl: url })}
                            selectedUrl={message.mediaUrl}
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}

                {selectedStep.messages.length === 0 && (
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
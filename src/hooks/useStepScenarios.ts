import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"

export interface StepScenario {
  id: string
  name: string
  description: string
  user_id: string
  is_active: boolean
  scenario_order: number
  prevent_auto_exit: boolean
  created_at: string
  updated_at: string
}

export interface Step {
  id: string
  scenario_id: string
  name: string
  step_order: number
  delivery_type: 'relative' | 'specific_time' | 'relative_to_previous'
  delivery_days: number
  delivery_hours: number
  delivery_minutes: number
  delivery_seconds: number
  specific_time?: string
  delivery_time_of_day?: string
  created_at: string
  updated_at: string
}

export interface StepMessage {
  id: string
  step_id: string
  message_order: number
  message_type: 'text' | 'media' | 'flex'
  content: string
  media_url?: string
  flex_message_id?: string
  created_at: string
  updated_at: string
}

export interface ScenarioTransition {
  id: string
  from_scenario_id: string
  to_scenario_id: string
  condition_type: string
  created_at: string
  updated_at: string
}

export interface ScenarioInviteCode {
  id: string
  scenario_id: string
  user_id: string
  invite_code: string
  usage_count: number
  max_usage?: number
  is_active: boolean
  allow_re_registration?: boolean
  re_registration_message?: string
  re_registration_action?: string
  created_at: string
  updated_at: string
}

export const useStepScenarios = (userId: string | undefined) => {
  const [scenarios, setScenarios] = useState<StepScenario[]>([])
  const [steps, setSteps] = useState<Step[]>([])
  const [messages, setMessages] = useState<StepMessage[]>([])
  const [transitions, setTransitions] = useState<ScenarioTransition[]>([])
  const [inviteCodes, setInviteCodes] = useState<ScenarioInviteCode[]>([])
  const [loading, setLoading] = useState(true)

  // シナリオ取得
  const fetchScenarios = async () => {
    if (!userId) return

    try {
      const { data, error } = await supabase
        .from('step_scenarios')
        .select('*')
        .eq('user_id', userId)
        .order('scenario_order', { ascending: true })

      if (error) throw error
      
      // prevent_auto_exitフィールドが正しく取得されているかログで確認
      console.log('Fetched scenarios with prevent_auto_exit:', data?.map(s => ({ 
        id: s.id, 
        name: s.name, 
        prevent_auto_exit: s.prevent_auto_exit 
      })))
      
      setScenarios(data || [])
    } catch (error) {
      console.error('シナリオの取得に失敗しました:', error)
      toast.error('シナリオの取得に失敗しました')
    }
  }

  // ステップ取得
  const fetchSteps = async () => {
    if (!userId) return

    try {
      const { data, error } = await supabase
        .from('steps')
        .select('*')
        .order('step_order', { ascending: true })

      if (error) throw error
      setSteps((data || []) as Step[])
    } catch (error) {
      console.error('ステップの取得に失敗しました:', error)
      toast.error('ステップの取得に失敗しました')
    }
  }

  // メッセージ取得
  const fetchMessages = async () => {
    if (!userId) return

    try {
      const { data, error } = await supabase
        .from('step_messages')
        .select('*')
        .order('message_order', { ascending: true })

      if (error) throw error
      setMessages((data || []) as StepMessage[])
    } catch (error) {
      console.error('メッセージの取得に失敗しました:', error)
      toast.error('メッセージの取得に失敗しました')
    }
  }

  // 移動設定取得
  const fetchTransitions = async () => {
    if (!userId) return

    try {
      const { data, error } = await supabase
        .from('scenario_transitions')
        .select('*')
        .order('created_at', { ascending: true })

      if (error) throw error
      setTransitions(data || [])
    } catch (error) {
      console.error('移動設定の取得に失敗しました:', error)
      toast.error('移動設定の取得に失敗しました')
    }
  }

  // 招待コード取得
  const fetchInviteCodes = async () => {
    if (!userId) return
    
    try {
      const { data, error } = await supabase
        .from('scenario_invite_codes')
        .select('*')
        .eq('user_id', userId)
      
      if (error) throw error
      setInviteCodes(data || [])
    } catch (error) {
      console.error('招待コードの取得に失敗しました:', error)
      toast.error('招待コードの取得に失敗しました')
    }
  }

  // 初期データ取得
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      await Promise.all([
        fetchScenarios(),
        fetchSteps(),
        fetchMessages(),
        fetchTransitions(),
        fetchInviteCodes()
      ])
      setLoading(false)
    }

    fetchData()
  }, [userId])

  // シナリオ作成
  const createScenario = async (name: string, description: string = '') => {
    if (!userId) return null

    try {
      const maxOrder = scenarios.length > 0 ? Math.max(...scenarios.map(s => s.scenario_order || 0)) : -1
      const { data, error } = await supabase
        .from('step_scenarios')
        .insert({
          user_id: userId,
          name,
          description,
          scenario_order: maxOrder + 1
        })
        .select()
        .single()

      if (error) throw error
      
      setScenarios(prev => [...prev, data])
      
      // シナリオ作成後、自動的に招待コードを生成
      await generateInviteCode(data.id)
      
      toast.success('シナリオを作成しました')
      return data
    } catch (error) {
      console.error('シナリオの作成に失敗しました:', error)
      toast.error('シナリオの作成に失敗しました')
      return null
    }
  }

  // シナリオ更新
  const updateScenario = async (id: string, updates: Partial<StepScenario>) => {
    try {
      const { data, error } = await supabase
        .from('step_scenarios')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      setScenarios(prev => prev.map(s => s.id === id ? data : s))
      return data
    } catch (error) {
      console.error('シナリオの更新に失敗しました:', error)
      toast.error('シナリオの更新に失敗しました')
      return null
    }
  }

  // シナリオ順序更新
  const reorderScenarios = async (newOrder: string[]) => {
    try {
      const updates = newOrder.map((scenarioId, index) => ({
        id: scenarioId,
        scenario_order: index
      }))

      for (const update of updates) {
        await supabase
          .from('step_scenarios')
          .update({ scenario_order: update.scenario_order })
          .eq('id', update.id)
      }

      await fetchScenarios()
      toast.success('シナリオの順序を更新しました')
    } catch (error) {
      console.error('シナリオの順序更新に失敗しました:', error)
      toast.error('シナリオの順序更新に失敗しました')
    }
  }

  // ステップ作成
  const createStep = async (scenarioId: string, name: string) => {
    const scenarioSteps = steps.filter(s => s.scenario_id === scenarioId)
    const stepOrder = scenarioSteps.length

    try {
      const { data, error } = await supabase
        .from('steps')
        .insert({
          scenario_id: scenarioId,
          name,
          step_order: stepOrder,
          delivery_type: 'relative',
          delivery_days: 0,
          delivery_hours: 0,
          delivery_minutes: 0,
          delivery_seconds: 0
        })
        .select()
        .single()

      if (error) throw error

      setSteps(prev => [...prev, data as Step])
      toast.success('ステップを作成しました')
      return data
    } catch (error) {
      console.error('ステップの作成に失敗しました:', error)
      toast.error('ステップの作成に失敗しました')
      return null
    }
  }

  // ステップ更新
  const updateStep = async (id: string, updates: Partial<Step>) => {
    try {
      const { data, error } = await supabase
        .from('steps')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      setSteps(prev => prev.map(s => s.id === id ? data as Step : s))
      return data
    } catch (error) {
      console.error('ステップの更新に失敗しました:', error)
      toast.error('ステップの更新に失敗しました')
      return null
    }
  }

  // ステップ順序更新
  const reorderSteps = async (scenarioId: string, newOrder: string[]) => {
    try {
      const updates = newOrder.map((stepId, index) => ({
        id: stepId,
        step_order: index
      }))

      for (const update of updates) {
        await supabase
          .from('steps')
          .update({ step_order: update.step_order })
          .eq('id', update.id)
      }

      await fetchSteps()
      toast.success('ステップの順序を更新しました')
    } catch (error) {
      console.error('ステップの順序更新に失敗しました:', error)
      toast.error('ステップの順序更新に失敗しました')
    }
  }


  // 移動設定作成
  const createTransition = async (fromScenarioId: string, toScenarioId: string) => {
    try {
      const { data, error } = await supabase
        .from('scenario_transitions')
        .insert({
          from_scenario_id: fromScenarioId,
          to_scenario_id: toScenarioId,
          condition_type: 'manual'
        })
        .select()
        .single()

      if (error) throw error

      setTransitions(prev => [...prev, data])
      toast.success('シナリオ移動を設定しました')

      // 完走済みユーザーにも後付けで適用
      try {
        const { data: applyRes, error: fnErr } = await supabase.functions.invoke('enhanced-step-delivery', {
          body: {
            action: 'apply_transition_to_completed',
            data: { fromScenarioId, toScenarioId }
          }
        })
        if (fnErr) throw fnErr
        // 統計更新を促す
        window.dispatchEvent(new Event('scenario-stats-updated'))
        const moved = (applyRes as any)?.moved ?? 0
        if (moved > 0) {
          toast.success(`完走ユーザー ${moved} 人を新シナリオへ移動しました`)
        }
      } catch (e) {
        console.warn('完走ユーザーの後付け移動に失敗:', e)
      }

      return data
    } catch (error) {
      console.error('シナリオ移動の設定に失敗しました:', error)
      toast.error('シナリオ移動の設定に失敗しました')
      return null
    }
  }

  // シナリオ削除
  const deleteScenario = async (id: string) => {
    try {
      const { error } = await supabase
        .from('step_scenarios')
        .delete()
        .eq('id', id)

      if (error) throw error

      setScenarios(prev => prev.filter(s => s.id !== id))
      toast.success('シナリオを削除しました')
    } catch (error) {
      console.error('シナリオの削除に失敗しました:', error)
      toast.error('シナリオの削除に失敗しました')
    }
  }

  // ステップ削除
  const deleteStep = async (id: string) => {
    try {
      const { error } = await supabase
        .from('steps')
        .delete()
        .eq('id', id)

      if (error) throw error

      setSteps(prev => prev.filter(s => s.id !== id))
      toast.success('ステップを削除しました')
    } catch (error) {
      console.error('ステップの削除に失敗しました:', error)
      toast.error('ステップの削除に失敗しました')
    }
  }

  // メッセージ作成
  const createMessage = async (stepId: string) => {
    try {
      const { data, error } = await supabase
        .from('step_messages')
        .insert({
          step_id: stepId,
          message_type: 'text',
          content: '',
          message_order: messages.filter(m => m.step_id === stepId).length
        })
        .select()
        .single()

      if (error) throw error

      const newMessage = data as StepMessage
      setMessages(prev => [...prev, newMessage])
      toast.success('メッセージを作成しました')
      return newMessage
    } catch (error) {
      console.error('メッセージの作成に失敗しました:', error)
      toast.error('メッセージの作成に失敗しました')
      return null
    }
  }

  // メッセージ更新
  const updateMessage = async (id: string, updates: Partial<StepMessage>) => {
    try {
      const { data, error } = await supabase
        .from('step_messages')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      const updatedMessage = data as StepMessage
      setMessages(prev => prev.map(m => m.id === id ? updatedMessage : m))
      return updatedMessage
    } catch (error) {
      console.error('メッセージの更新に失敗しました:', error)
      toast.error('メッセージの更新に失敗しました')
      return null
    }
  }

  // メッセージ削除
  const deleteMessage = async (id: string) => {
    try {
      const { error } = await supabase
        .from('step_messages')
        .delete()
        .eq('id', id)

      if (error) throw error

      setMessages(prev => prev.filter(m => m.id !== id))
      toast.success('メッセージを削除しました')
    } catch (error) {
      console.error('メッセージの削除に失敗しました:', error)
      toast.error('メッセージの削除に失敗しました')
    }
  }

  // 移動設定削除
  const deleteTransition = async (id: string) => {
    try {
      const { error } = await supabase
        .from('scenario_transitions')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      setTransitions(prev => prev.filter(t => t.id !== id))
      toast.success('シナリオ移動を削除しました')
    } catch (error) {
      console.error('シナリオ移動の削除に失敗しました:', error)
      toast.error('シナリオ移動の削除に失敗しました')
    }
  }

  // 招待コードを生成
  const generateInviteCode = async (scenarioId: string, maxUsage?: number) => {
    if (!userId) return null
    
    try {
      // 既存の招待コードをチェック
      const existing = inviteCodes.find(code => code.scenario_id === scenarioId && code.is_active)
      if (existing) {
        // フロントエンドの招待ページURLを生成
        const inviteUrl = `${window.location.origin}/invite/${existing.invite_code}`
        return { ...existing, inviteUrl }
      }

      // ランダムコードを生成
      const inviteCode = Math.random().toString(36).substring(2, 10)
      
      const { data, error } = await supabase
        .from('scenario_invite_codes')
        .insert({
          scenario_id: scenarioId,
          user_id: userId,
          invite_code: inviteCode,
          max_usage: maxUsage || null,
          usage_count: 0,
          is_active: true
        })
        .select()
        .single()
      
      if (error) throw error
      
      const newCode = data as ScenarioInviteCode
      setInviteCodes(prev => [...prev, newCode])
      
      // フロントエンドの招待ページURLを生成
      const inviteUrl = `${window.location.origin}/invite/${inviteCode}`
      
      toast.success('招待コードを生成しました')
      return { ...newCode, inviteUrl }
    } catch (error) {
      console.error('招待コード生成エラー:', error)
      toast.error('招待コードの生成に失敗しました')
      return null
    }
  }

  // データの再取得
  const refetch = async () => {
    if (!userId) return
    await Promise.all([
      fetchScenarios(),
      fetchSteps(),
      fetchMessages(),
      fetchTransitions(),
      fetchInviteCodes()
    ])
  }

  // 招待コードを無効化
  const deactivateInviteCode = async (codeId: string) => {
    try {
      const { error } = await supabase
        .from('scenario_invite_codes')
        .update({ is_active: false })
        .eq('id', codeId)
      
      if (error) throw error
      
      setInviteCodes(prev => prev.map(code => 
        code.id === codeId ? { ...code, is_active: false } : code
      ))
      toast.success('招待コードを無効化しました')
    } catch (error) {
      console.error('招待コード無効化エラー:', error)
      toast.error('招待コードの無効化に失敗しました')
    }
  }

  return {
    scenarios,
    steps,
    messages,
    transitions,
    inviteCodes,
    loading,
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
    deactivateInviteCode,
    refetch
  }
}
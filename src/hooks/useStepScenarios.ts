import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"

export interface StepScenario {
  id: string
  name: string
  description: string
  user_id: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Step {
  id: string
  scenario_id: string
  name: string
  step_order: number
  delivery_type: 'after_registration' | 'specific_time'
  delivery_days: number
  delivery_hours: number
  delivery_minutes: number
  specific_time?: string
  created_at: string
  updated_at: string
}

export interface StepMessage {
  id: string
  step_id: string
  message_order: number
  message_type: 'text' | 'media'
  content: string
  media_url?: string
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

export const useStepScenarios = (userId: string | undefined) => {
  const [scenarios, setScenarios] = useState<StepScenario[]>([])
  const [steps, setSteps] = useState<Step[]>([])
  const [messages, setMessages] = useState<StepMessage[]>([])
  const [transitions, setTransitions] = useState<ScenarioTransition[]>([])
  const [loading, setLoading] = useState(true)

  // シナリオ取得
  const fetchScenarios = async () => {
    if (!userId) return

    try {
      const { data, error } = await supabase
        .from('step_scenarios')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })

      if (error) throw error
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

  // 初期データ取得
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      await Promise.all([
        fetchScenarios(),
        fetchSteps(),
        fetchMessages(),
        fetchTransitions()
      ])
      setLoading(false)
    }

    fetchData()
  }, [userId])

  // シナリオ作成
  const createScenario = async (name: string, description: string = '') => {
    if (!userId) return null

    try {
      const { data, error } = await supabase
        .from('step_scenarios')
        .insert({
          user_id: userId,
          name,
          description
        })
        .select()
        .single()

      if (error) throw error
      
      setScenarios(prev => [...prev, data])
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
          delivery_type: 'after_registration',
          delivery_days: 0,
          delivery_hours: 0,
          delivery_minutes: 0
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

  // メッセージ作成
  const createMessage = async (stepId: string, type: 'text' | 'media' = 'text') => {
    const stepMessages = messages.filter(m => m.step_id === stepId)
    const messageOrder = stepMessages.length

    try {
      const { data, error } = await supabase
        .from('step_messages')
        .insert({
          step_id: stepId,
          message_order: messageOrder,
          message_type: type,
          content: ''
        })
        .select()
        .single()

      if (error) throw error

      setMessages(prev => [...prev, data as StepMessage])
      toast.success('メッセージを作成しました')
      return data
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

      setMessages(prev => prev.map(m => m.id === id ? data as StepMessage : m))
      return data
    } catch (error) {
      console.error('メッセージの更新に失敗しました:', error)
      toast.error('メッセージの更新に失敗しました')
      return null
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
      return data
    } catch (error) {
      console.error('シナリオ移動の設定に失敗しました:', error)
      toast.error('シナリオ移動の設定に失敗しました')
      return null
    }
  }

  return {
    scenarios,
    steps,
    messages,
    transitions,
    loading,
    createScenario,
    updateScenario,
    createStep,
    updateStep,
    reorderSteps,
    createMessage,
    updateMessage,
    createTransition,
    refetch: () => {
      fetchScenarios()
      fetchSteps()
      fetchMessages()
      fetchTransitions()
    }
  }
}
import { useState, useEffect } from "react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import {
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Card, CardContent } from "@/components/ui/card"
import { GripVertical, Trash2, Edit2 } from "lucide-react"
import { Step } from "@/hooks/useStepScenarios"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { supabase } from "@/integrations/supabase/client"

interface SortableStepCardProps {
  step: Step
  index: number
  isSelected: boolean
  onClick: () => void
  onDelete: () => void
  onUpdateName: (stepId: string, name: string) => void
  allSteps: Step[]
  readyCount?: number
}

function SortableStepCard({ step, index, isSelected, onClick, onDelete, onUpdateName, allSteps, readyCount }: SortableStepCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [tempName, setTempName] = useState(step.name)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const handleNameSave = () => {
    if (tempName.trim() && tempName !== step.name) {
      onUpdateName(step.id, tempName.trim())
    }
    setIsEditing(false)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSave()
    } else if (e.key === 'Escape') {
      setTempName(step.name)
      setIsEditing(false)
    }
  }

  const getDeliveryTimeText = () => {
    if (index === 0) {
      const days = step.delivery_days || 0
      const hours = step.delivery_hours || 0
      const minutes = step.delivery_minutes || 0
      const seconds = step.delivery_seconds || 0
      
      if (days === 0 && hours === 0 && minutes === 0 && seconds === 0) {
        return "登録後：即時配信"
      }
      
      const parts = []
      if (days > 0) parts.push(`${days}日`)
      if (hours > 0) parts.push(`${hours}時間`)
      if (minutes > 0) parts.push(`${minutes}分`)
      if (seconds > 0) parts.push(`${seconds}秒`)
      
      return `登録後：${parts.join('')}後`
    } else {
      const days = step.delivery_days || 0
      const hours = step.delivery_hours || 0
      const minutes = step.delivery_minutes || 0
      const seconds = step.delivery_seconds || 0
      
      if (days === 0 && hours === 0 && minutes === 0 && seconds === 0) {
        return "前ステップから：即時配信"
      }
      
      const parts = []
      if (days > 0) parts.push(`${days}日`)
      if (hours > 0) parts.push(`${hours}時間`)
      if (minutes > 0) parts.push(`${minutes}分`)
      if (seconds > 0) parts.push(`${seconds}秒`)
      
      return `前ステップから：${parts.join('')}後`
    }
  }

  return (
    <Card 
      ref={setNodeRef}
      style={style}
      className={`cursor-pointer transition-colors group ${
        isSelected ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
      }`}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center flex-shrink-0">
            {index + 1}
          </div>
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <Input
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                onBlur={handleNameSave}
                onKeyDown={handleKeyPress}
                className="h-6 text-sm px-1"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <h4 className="font-medium">{step.name}</h4>
            )}
            <p className="text-xs text-muted-foreground">
              {getDeliveryTimeText()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs" title="このステップにいる人数">👥 {readyCount ?? 0}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                setIsEditing(true)
                setTempName(step.name)
              }}
              className="flex-shrink-0 h-6 w-6 p-0"
            >
              <Edit2 className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              className="flex-shrink-0 h-6 w-6 p-0"
            >
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface DraggableStepsListProps {
  steps: Step[]
  selectedStep: Step | null
  onStepSelect: (step: Step) => void
  onReorder: (newOrder: string[]) => void
  onStepDelete: (stepId: string) => void
  onStepUpdate: (stepId: string, name: string) => void
}

export function DraggableStepsList({ 
  steps, 
  selectedStep, 
  onStepSelect, 
  onReorder,
  onStepDelete,
  onStepUpdate
}: DraggableStepsListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const [readyCounts, setReadyCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    const ids = steps.map(s => s.id)
    if (ids.length === 0) { setReadyCounts({}); return }
    ;(async () => {
      const { data, error } = await supabase
        .from('step_delivery_tracking')
        .select('step_id')
        .in('step_id', ids)
        .eq('status', 'ready')
      if (error) {
        console.error('ステップ人数取得失敗:', error)
        setReadyCounts({})
        return
      }
      const counts: Record<string, number> = {}
      ;(data || []).forEach((row: any) => {
        counts[row.step_id] = (counts[row.step_id] || 0) + 1
      })
      setReadyCounts(counts)
    })()
  }, [steps.map(s => s.id).join(',')])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (active.id !== over?.id) {
      const oldIndex = steps.findIndex(step => step.id === active.id)
      const newIndex = steps.findIndex(step => step.id === over?.id)
      
      const newOrder = arrayMove(steps, oldIndex, newIndex)
      onReorder(newOrder.map(step => step.id))
    }
  }

  return (
    <DndContext 
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={steps.map(s => s.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {steps.map((step, index) => (
              <SortableStepCard
                key={step.id}
                step={step}
                index={index}
                isSelected={selectedStep?.id === step.id}
                onClick={() => onStepSelect(step)}
                onDelete={() => onStepDelete(step.id)}
                onUpdateName={onStepUpdate}
                allSteps={steps}
                readyCount={readyCounts[step.id] || 0}
              />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
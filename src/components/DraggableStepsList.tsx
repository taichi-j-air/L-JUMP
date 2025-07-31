import { useState } from "react"
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
import { GripVertical, Trash2 } from "lucide-react"
import { Step } from "@/hooks/useStepScenarios"
import { Button } from "@/components/ui/button"

interface SortableStepCardProps {
  step: Step
  index: number
  isSelected: boolean
  onClick: () => void
  onDelete: () => void
  allSteps: Step[]
}

function SortableStepCard({ step, index, isSelected, onClick, onDelete, allSteps }: SortableStepCardProps) {
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

  const getDeliveryTimeText = () => {
    if (index === 0) {
      return "登録後"
    } else {
      const parts = []
      if (step.delivery_days > 0) parts.push(`${step.delivery_days}日後`)
      if (step.delivery_hours > 0) parts.push(`${step.delivery_hours}時間後`)
      if (step.delivery_minutes > 0) parts.push(`${step.delivery_minutes}分後`)
      if (step.delivery_seconds > 0) parts.push(`${step.delivery_seconds}秒後`)
      return parts.length > 0 ? parts.join(' ') : "即時"
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
            <h4 className="font-medium">{step.name}</h4>
            <p className="text-xs text-muted-foreground">
              {getDeliveryTimeText()}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
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
}

export function DraggableStepsList({ 
  steps, 
  selectedStep, 
  onStepSelect, 
  onReorder,
  onStepDelete
}: DraggableStepsListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

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
              allSteps={steps}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
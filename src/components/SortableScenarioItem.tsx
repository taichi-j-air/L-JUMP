import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Trash2, GripVertical, Users, UserX, Ban } from "lucide-react"
import { StepScenario } from "@/hooks/useStepScenarios"

interface SortableScenarioItemProps {
  scenario: StepScenario
  isSelected: boolean
  scenarioSteps: number
  deliveryTime: string
  transitionDestinations: string[]
  stats?: { registered: number; exited: number; blocked: number; total?: number }
  onSelect: () => void
  onDelete: () => void
}

export function SortableScenarioItem({
  scenario,
  isSelected,
  scenarioSteps,
  deliveryTime,
  transitionDestinations,
  onSelect,
  onDelete,
  stats,
}: SortableScenarioItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: scenario.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <Card 
      ref={setNodeRef}
      style={style}
      className={`cursor-pointer transition-colors group ${
        isSelected ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
      }`}
      onClick={onSelect}
      {...attributes}
      {...listeners}
    >
      <CardContent className="p-2">
        <div className="flex items-start gap-1.5">
          <div 
            className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-muted rounded flex-shrink-0"
          >
            <GripVertical className="h-3 w-3 text-muted-foreground" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium truncate leading-tight">{scenario.name}</h3>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground truncate">
              <span>{scenarioSteps} ステップ</span>
              <span>配信: {deliveryTime}</span>
              {transitionDestinations.length > 0 && (
                <span className="truncate">→ {transitionDestinations.join(' / ')}</span>
              )}
            </div>
            {stats && (
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><Users className="h-3 w-3" />累計 {stats.total ?? 0}</span>
                <span>現在 {stats.registered}</span>
                <span className="flex items-center gap-1"><UserX className="h-3 w-3" />離脱 {stats.exited}</span>
                <span className="flex items-center gap-1"><Ban className="h-3 w-3" />失敗 {stats.blocked}</span>
              </div>
            )}
          </div>
          
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
      </CardContent>
    </Card>
  )
}
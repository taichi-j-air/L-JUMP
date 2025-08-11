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
  stats?: { registered: number; exited: number; blocked: number }
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
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <div 
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded flex-shrink-0"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-medium">{scenario.name}</h3>
            <p className="text-sm text-muted-foreground">{scenarioSteps} ステップ・配信: {deliveryTime}</p>
            {stats && (
              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Users className="h-3 w-3" />{stats.registered}</span>
                <span className="flex items-center gap-1"><UserX className="h-3 w-3" />{stats.exited}</span>
                <span className="flex items-center gap-1"><Ban className="h-3 w-3" />{stats.blocked}</span>
              </div>
            )}
            {transitionDestinations.length > 0 && (
              <div className="mt-1">
                {transitionDestinations.length === 1 ? (
                  <p className="text-xs text-blue-600">
                    → {transitionDestinations[0]}
                  </p>
                ) : (
                  <div className="space-y-1">
                    <p className="text-xs text-orange-600 font-medium">
                      ABテスト設定
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {transitionDestinations.map((dest, index) => (
                        <span key={index} className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                          → {dest}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
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
            className="flex-shrink-0"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
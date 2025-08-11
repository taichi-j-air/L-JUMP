import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, Plus, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export type FormField = {
  id: string;
  label: string;
  name: string;
  type: string;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  rows?: number;
};

interface Props {
  fields: FormField[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onReorder: (orderedIds: string[]) => void;
  rightActions?: any;
}

function SortableItem({
  field,
  isSelected,
  onSelect,
  onRemove,
}: {
  field: FormField;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: field.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={
        "flex items-center justify-between rounded-md border px-2 py-1 cursor-pointer select-none " +
        (isSelected ? "bg-muted" : "hover:bg-muted/50")
      }
      onClick={() => onSelect(field.id)}
    >
      <div className="flex items-center gap-2 min-w-0">
        <button
          {...attributes}
          {...listeners}
          className="shrink-0 p-1 rounded hover:bg-muted"
          aria-label="並び替え"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <div className="text-xs font-medium truncate">{field.label || "未設定"}</div>
          <div className="text-[10px] text-muted-foreground truncate">{field.type}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {field.required && (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5 rounded">必須</Badge>
        )}
        <Button
          size="icon"
          variant="destructive"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(field.id);
          }}
          aria-label="フィールド削除"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function FormFieldList({
  fields,
  selectedId,
  onSelect,
  onAdd,
  onRemove,
  onReorder,
  rightActions,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = fields.findIndex((f) => f.id === active.id);
    const newIndex = fields.findIndex((f) => f.id === over.id);
    const newOrder = arrayMove(fields.map((f) => f.id), oldIndex, newIndex);
    onReorder(newOrder);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium">フィールド</div>
        <div className="flex items-center gap-2">
          {rightActions}
          <Button variant="outline" size="sm" onClick={onAdd}>
            <Plus className="mr-2 h-4 w-4" /> 追加
          </Button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <ScrollArea className="h-[360px] rounded-md border">
          <div className="p-2 space-y-1">
            {fields.length === 0 && (
              <p className="text-xs text-muted-foreground">フィールドがありません</p>
            )}
            <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
              {fields.map((f) => (
                <SortableItem
                  key={f.id}
                  field={f}
                  isSelected={selectedId === f.id}
                  onSelect={onSelect}
                  onRemove={onRemove}
                />
              ))}
            </SortableContext>
          </div>
        </ScrollArea>
      </DndContext>
    </div>
  );
}

import { useState } from "react"
import { useDroppable } from "@dnd-kit/core"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { ChevronDown, ChevronRight, Pencil, Undo2, Trash2, GripVertical } from "lucide-react"
import type { ScenarioFolder } from "@/hooks/useScenarioFolders"
import { ColorPicker as HexColorPicker } from "@/components/ui/color-picker"

interface ScenarioFoldersProps {
  folders: ScenarioFolder[]
  onAdd: () => void
  onRename: (id: string, name: string) => void
  onBorderColor: (id: string, colorHex: string) => void
  onToggle: (id: string) => void
  onMoveOut: (scenarioId: string) => void
  onDelete: (id: string) => void
  getScenarioName: (id: string) => string
  renderScenario: (scenarioId: string) => JSX.Element | null
}

export function ScenarioFolders({
  folders,
  onAdd,
  onRename,
  onColor,
  onToggle,
  onMoveOut,
  onDelete,
  getScenarioName,
  renderScenario,
}: ScenarioFoldersProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [tempName, setTempName] = useState('')

  return (
    <div className="space-y-2">
      {folders.map(folder => (
        <FolderRow
          key={folder.id}
          folder={folder}
          editing={editingId === folder.id}
          tempName={tempName}
          onStartEdit={() => { setEditingId(folder.id); setTempName(folder.name) }}
          onCancelEdit={() => { setEditingId(null); setTempName('') }}
          onCommitEdit={(name) => { onRename(folder.id, name); setEditingId(null) }}
          onTempNameChange={(name) => setTempName(name)}
          onColor={(c) => onColor(folder.id, c)}
          onToggle={() => onToggle(folder.id)}
          onMoveOut={onMoveOut}
          onDelete={() => onDelete(folder.id)}
          getScenarioName={getScenarioName}
          renderScenario={renderScenario}
        />
      ))}
    </div>
  )
}

function FolderRow({
  folder,
  editing,
  tempName,
  onStartEdit,
  onCancelEdit,
  onCommitEdit,
  onTempNameChange,
  onColor,
  onToggle,
  onMoveOut,
  onDelete,
  getScenarioName,
  renderScenario,
}: {
  folder: ScenarioFolder
  editing: boolean
  tempName: string
  onStartEdit: () => void
  onCancelEdit: () => void
  onCommitEdit: (name: string) => void
  onTempNameChange: (name: string) => void
  onColor: (c: FolderColor) => void
  onToggle: () => void
  onMoveOut: (scenarioId: string) => void
  onDelete: () => void
  getScenarioName: (id: string) => string
  renderScenario: (scenarioId: string) => JSX.Element | null
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `folder:${folder.id}` })
  const { attributes, listeners, setNodeRef: setSortableRef, transform, transition, isDragging } = useSortable({ id: `folderItem:${folder.id}` })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }

  return (
    <Card ref={(node) => { setNodeRef(node); setSortableRef(node as any) }} style={style} className={`border-2 ${borderClass[folder.color]} ${isOver ? 'ring-2 ring-primary' : ''}`}>
      <CardContent className="p-2">
        <div className="flex items-center gap-2">
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded h-6 w-6 flex items-center justify-center">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
          <Button variant="ghost" size="icon" onClick={onToggle} className="h-6 w-6">
            {folder.collapsed ? <ChevronRight className="h-4 w-4"/> : <ChevronDown className="h-4 w-4"/>}
          </Button>
          {editing ? (
            <input
              className="text-sm bg-transparent border-b border-border focus:outline-none"
              value={tempName}
              onChange={(e) => onTempNameChange(e.target.value)}
              onBlur={() => onCommitEdit(tempName)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onCommitEdit(tempName)
                if (e.key === 'Escape') onCancelEdit()
              }}
            />
          ) : (
            <span className="text-sm font-medium">
              {folder.name}
            </span>
          )}
          <span className="text-xs text-muted-foreground">{folder.scenarioIds.length}件</span>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={onStartEdit} className="h-6 w-6"><Pencil className="h-3 w-3"/></Button>
            <ColorPicker current={folder.color} onSelect={onColor} />
            <DeleteFolderButton onDelete={onDelete} folderName={folder.name} scenarioNames={folder.scenarioIds.map(getScenarioName)} />
          </div>
        </div>
        {!folder.collapsed && (
          <div className="mt-2 space-y-2">
            {folder.scenarioIds.length === 0 ? (
              <div className="text-xs text-muted-foreground">ここにドラッグ＆ドロップ</div>
            ) : (
              folder.scenarioIds.map(id => (
                <div key={id} className="group relative">
                  {renderScenario(id)}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 h-6 px-2"
                    onClick={(e) => { e.stopPropagation(); onMoveOut(id) }}
                  >
                    <Undo2 className="h-3 w-3 mr-1"/>外に出す
                  </Button>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ColorPicker({ current, onSelect }: { current: FolderColor; onSelect: (c: FolderColor) => void }) {
  const colors: FolderColor[] = ['primary','secondary','accent','destructive','muted']
  return (
    <div className="flex items-center gap-1">
      <Paintbrush className="h-3 w-3 text-muted-foreground"/>
      {colors.map(c => (
        <button
          key={c}
          aria-label={c}
          onClick={(e) => { e.stopPropagation(); onSelect(c) }}
          className={`h-3 w-3 rounded-full ${colorClass[c]} border border-border`}
        />
      ))}
    </div>
  )
}

function DeleteFolderButton({ onDelete, folderName, scenarioNames }: { onDelete: () => void; folderName: string; scenarioNames: string[] }) {
  const hasItems = scenarioNames.length > 0
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6">
          <Trash2 className="h-3 w-3 text-destructive" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>フォルダを削除しますか？</AlertDialogTitle>
          <AlertDialogDescription>
            {hasItems ? (
              <div className="space-y-2">
                <p>以下のシナリオがこのフォルダに入っています：</p>
                <ul className="list-disc pl-4 text-foreground">
                  {scenarioNames.map((n, i) => (<li key={i}>{n}</li>))}
                </ul>
                <p>本当に削除してもよろしいですか？</p>
              </div>
            ) : (
              <p>「{folderName}」を削除してもよろしいですか？</p>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>キャンセル</AlertDialogCancel>
          <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">削除する</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

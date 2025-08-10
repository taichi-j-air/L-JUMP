import { useState } from "react"
import { useDroppable } from "@dnd-kit/core"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ChevronDown, ChevronRight, Paintbrush, Pencil, Undo2 } from "lucide-react"
import type { ScenarioFolder, FolderColor } from "@/hooks/useScenarioFolders"

interface ScenarioFoldersProps {
  folders: ScenarioFolder[]
  onAdd: () => void
  onRename: (id: string, name: string) => void
  onColor: (id: string, color: FolderColor) => void
  onToggle: (id: string) => void
  onMoveOut: (scenarioId: string) => void
  renderScenario: (scenarioId: string) => JSX.Element | null
}

const colorClass: Record<FolderColor, string> = {
  primary: 'bg-primary',
  secondary: 'bg-secondary',
  accent: 'bg-accent',
  destructive: 'bg-destructive',
  muted: 'bg-muted',
}

export function ScenarioFolders({
  folders,
  onAdd,
  onRename,
  onColor,
  onToggle,
  onMoveOut,
  renderScenario,
}: ScenarioFoldersProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [tempName, setTempName] = useState('')

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">フォルダ</span>
        <Button size="sm" variant="outline" onClick={onAdd}>追加</Button>
      </div>

      {folders.map(folder => (
        <FolderRow
          key={folder.id}
          folder={folder}
          editing={editingId === folder.id}
          tempName={tempName}
          onStartEdit={() => { setEditingId(folder.id); setTempName(folder.name) }}
          onCancelEdit={() => { setEditingId(null); setTempName('') }}
          onCommitEdit={(name) => { onRename(folder.id, name); setEditingId(null) }}
          onColor={(c) => onColor(folder.id, c)}
          onToggle={() => onToggle(folder.id)}
          onMoveOut={onMoveOut}
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
  onColor,
  onToggle,
  onMoveOut,
  renderScenario,
}: {
  folder: ScenarioFolder
  editing: boolean
  tempName: string
  onStartEdit: () => void
  onCancelEdit: () => void
  onCommitEdit: (name: string) => void
  onColor: (c: FolderColor) => void
  onToggle: () => void
  onMoveOut: (scenarioId: string) => void
  renderScenario: (scenarioId: string) => JSX.Element | null
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `folder:${folder.id}` })

  return (
    <Card ref={setNodeRef} className={"border-dashed " + (isOver ? 'border-primary' : '')}>
      <CardContent className="p-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onToggle} className="h-6 w-6">
            {folder.collapsed ? <ChevronRight className="h-4 w-4"/> : <ChevronDown className="h-4 w-4"/>}
          </Button>
          <div className={`h-3 w-3 rounded-full ${colorClass[folder.color]} flex-shrink-0`} />
          {editing ? (
            <input
              className="text-sm bg-transparent border-b border-border focus:outline-none"
              value={tempName}
              onChange={(e) => onCommitEdit(e.target.value)}
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

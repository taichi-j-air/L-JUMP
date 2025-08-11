import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, Plus } from "lucide-react";

export type FormField = {
  id: string;
  label: string;
  name: string;
  type: string;
  required?: boolean;
  options?: string[];
};

interface Props {
  fields: FormField[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  newFieldType: string;
  setNewFieldType: (v: string) => void;
}

export default function FormFieldList({
  fields,
  selectedId,
  onSelect,
  onAdd,
  onRemove,
  newFieldType,
  setNewFieldType,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Select value={newFieldType} onValueChange={setNewFieldType}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="タイプを選択" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="text">テキスト</SelectItem>
            <SelectItem value="email">メール</SelectItem>
            <SelectItem value="textarea">テキストエリア</SelectItem>
            <SelectItem value="select">ドロップダウン</SelectItem>
            <SelectItem value="radio">ラジオボタン</SelectItem>
            <SelectItem value="checkbox">チェックボックス</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={onAdd}>
          <Plus className="mr-2 h-4 w-4" /> 追加
        </Button>
      </div>

      <ScrollArea className="h-[360px] rounded-md border">
        <div className="p-2 space-y-2">
          {fields.length === 0 && (
            <p className="text-sm text-muted-foreground">フィールドがありません</p>
          )}
          {fields.map((f, idx) => (
            <div
              key={f.id}
              className={
                "flex items-center justify-between rounded-md border p-2 cursor-pointer transition-colors " +
                (selectedId === f.id ? "bg-muted" : "hover:bg-muted/50")
              }
              onClick={() => onSelect(f.id)}
            >
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{idx + 1}. {f.label || "未設定"}</div>
                <div className="text-xs text-muted-foreground truncate">{f.name || "キー未設定"}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{f.type}</Badge>
                <Button
                  size="icon"
                  variant="destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(f.id);
                  }}
                  aria-label="フィールド削除"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

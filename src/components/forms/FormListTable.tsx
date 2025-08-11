import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";

export interface FormListItem {
  id: string;
  name: string;
  description?: string | null;
  fields?: Array<{ id: string }>; // minimal for count display
}

interface Props {
  items: FormListItem[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  unreadCounts?: Record<string, number>;
  badgeEnabledMap?: Record<string, boolean>;
  onToggleBadge?: (id: string) => void;
}

export default function FormListTable({
  items,
  loading,
  selectedId,
  onSelect,
  unreadCounts = {},
  badgeEnabledMap = {},
  onToggleBadge,
}: Props) {
  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-base">フォーム一覧</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground">読み込み中...</p>
        ) : (
          <ScrollArea className="h-[560px] pr-2">
            <div className="space-y-2">
              {items.length === 0 && (
                <p className="text-xs text-muted-foreground">まだフォームがありません</p>
              )}
              {items.map((f) => {
                const unread = unreadCounts[f.id] || 0;
                const enabled = badgeEnabledMap[f.id] !== false; // default true
                return (
                  <div
                    key={f.id}
                    className={
                      "rounded-md border px-3 py-2 transition-colors cursor-pointer " +
                      (selectedId === f.id ? "bg-muted" : "hover:bg-muted/50")
                    }
                    onClick={() => onSelect(f.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate flex items-center gap-2">
                          <span className="truncate">{f.name}</span>
                          {unread > 0 && enabled && (
                            <Badge variant="destructive" className="shrink-0">
                              {unread}
                            </Badge>
                          )}
                        </div>
                        {f.description && (
                          <div className="text-[11px] text-muted-foreground truncate">
                            {f.description}
                          </div>
                        )}
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          項目: {f.fields?.length || 0}
                        </div>
                      </div>
                      {onToggleBadge && (
                        <div
                          className="flex items-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-[10px] text-muted-foreground">通知</span>
                          <Switch
                            checked={enabled}
                            onCheckedChange={() => onToggleBadge(f.id)}
                            aria-label="通知バッジの有効/無効"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Bell, BellOff } from "lucide-react";
export interface FormListTableItem {
  id: string;
  name: string;
  description?: string | null;
}

interface Props {
  items: FormListTableItem[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  unreadCounts?: Record<string, number>;
  badgeEnabledMap?: Record<string, boolean>;
  onToggleBadge?: (id: string) => void;
}

export default function FormListTable({ items, loading, selectedId, onSelect, unreadCounts, badgeEnabledMap, onToggleBadge }: Props) {
  return (
    <Card>
      <CardHeader className="py-0.5">
        <CardTitle className="text-base">フォーム一覧</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 pb-2">
        {loading ? (
          <p className="text-muted-foreground">読み込み中...</p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 py-0.5"></TableHead>
                  <TableHead className="py-0.5">フォーム名</TableHead>
                  <TableHead className="w-12 text-right py-0.5"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-xs text-muted-foreground py-0.5">まだフォームがありません</TableCell>
                  </TableRow>
                )}
                {items.map((f) => (
                  <TableRow
                    key={f.id}
                    className={(selectedId === f.id ? "bg-muted/50" : "cursor-pointer hover:bg-muted/40") + " py-1"}
                    onClick={() => onSelect(f.id)}
                  >
                    <TableCell className="align-middle py-0.5">
                      {unreadCounts && (badgeEnabledMap?.[f.id] !== false) && (unreadCounts[f.id] > 0) && (
                        <span className="inline-block h-2 w-2 rounded-full bg-destructive" aria-label="新着" />
                      )}
                    </TableCell>
                    <TableCell className="align-middle py-0.5">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold" title={f.name}>{f.name}</div>
                        {f.description && (
                          <div className="truncate text-[11px] text-muted-foreground" title={f.description || undefined}>{f.description}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="align-middle text-right py-0.5">
                      {onToggleBadge && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="通知バッジ切替"
                          onClick={(e) => { e.stopPropagation(); onToggleBadge(f.id); }}
                        >
                          {(badgeEnabledMap?.[f.id] !== false) ? (
                            <Bell className="h-4 w-4" />
                          ) : (
                            <BellOff className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
}

export default function FormListTable({ items, loading, selectedId, onSelect, unreadCounts }: Props) {
  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-base">フォーム一覧</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground">読み込み中...</p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>フォーム名</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-xs text-muted-foreground">まだフォームがありません</TableCell>
                  </TableRow>
                )}
                {items.map((f) => (
                  <TableRow
                    key={f.id}
                    className={selectedId === f.id ? "bg-muted/50" : "cursor-pointer hover:bg-muted/40"}
                    onClick={() => onSelect(f.id)}
                  >
                    <TableCell className="align-middle">
                      {unreadCounts && unreadCounts[f.id] > 0 && (
                        <span className="inline-block h-2 w-2 rounded-full bg-destructive" aria-label="新着" />
                      )}
                    </TableCell>
                    <TableCell className="align-middle">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold" title={f.name}>{f.name}</div>
                        {f.description && (
                          <div className="truncate text-[11px] text-muted-foreground" title={f.description || undefined}>{f.description}</div>
                        )}
                      </div>
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

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Copy, Link as LinkIcon, Pencil, Plus, Trash2 } from "lucide-react";

export interface FormListItem {
  id: string;
  name: string;
  description?: string | null;
  is_public?: boolean;
  fields?: Array<any>;
}

interface Props {
  items: FormListItem[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddNew: () => void;
  onCopyLink: (id: string) => void;
  onOpenPublic: (id: string) => void;
  onDelete: (id: string) => void;
  unreadCounts?: Record<string, number>;
}

export default function FormListPanel({
  items,
  loading,
  selectedId,
  onSelect,
  onAddNew,
  onCopyLink,
  onOpenPublic,
  onDelete,
}: Props) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <CardTitle className="text-base">フォーム一覧</CardTitle>
        <Button size="sm" variant="outline" onClick={onAddNew}>
          <Plus className="mr-2 h-4 w-4" /> 追加
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground">読み込み中...</p>
        ) : (
          <ScrollArea className="h-[560px]">
            <div className="space-y-2 pr-2">
              {items.length === 0 && <p className="text-xs text-muted-foreground">まだフォームがありません</p>}
              {items.map((f) => (
                <div
                  key={f.id}
                  className={
                    "rounded-md border px-2 py-1 space-y-1 transition-colors cursor-pointer " +
                    (selectedId === f.id ? "bg-muted" : "hover:bg-muted/50")
                  }
                  onClick={() => onSelect(f.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{f.name}</div>
                      {f.description && (
                        <div className="text-[10px] text-muted-foreground truncate">{f.description}</div>
                      )}
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        項目: {f.fields?.length || 0} / 公開: {f.is_public ? "はい" : "いいえ"}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <TooltipProvider>
                        <div className="flex items-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="secondary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onCopyLink(f.id);
                                }}
                                aria-label="埋め込みURLをコピー"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>URLをコピー</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenPublic(f.id);
                                }}
                                aria-label="公開ページ"
                              >
                                <LinkIcon className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>公開ページを開く</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon" variant="destructive" aria-label="削除"
                                onClick={(e) => { e.stopPropagation(); onDelete(f.id); }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>削除</TooltipContent>
                          </Tooltip>
                        </div>
                      </TooltipProvider>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

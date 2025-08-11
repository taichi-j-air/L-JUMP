import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Save, Trash2, X } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
interface TagRow {
  id: string;
  name: string;
  color: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
}

const useSEO = (title: string, description: string, canonical?: string) => {
  useEffect(() => {
    document.title = title;
    const meta = document.querySelector('meta[name="description"]') || document.createElement('meta');
    meta.setAttribute('name', 'description');
    meta.setAttribute('content', description);
    document.head.appendChild(meta);

    if (canonical) {
      let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'canonical';
        document.head.appendChild(link);
      }
      link.href = canonical;
    }
  }, [title, description, canonical]);
};

export default function TagsManager() {
  useSEO(
    "タグ管理 | セグメント作成",
    "タグの作成・編集・削除で友だちをセグメント管理",
    window.location.href
  );

  const [tags, setTags] = useState<TagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTag, setNewTag] = useState({ name: "", color: "", description: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ name: string; color: string; description: string }>({ name: "", color: "", description: "" });

  const sorted = useMemo(() => tags.sort((a, b) => b.updated_at.localeCompare(a.updated_at)), [tags]);

  const loadTags = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('tags')
      .select('*')
      .order('updated_at', { ascending: false });
    if (error) {
      console.error(error);
      toast.error('タグの取得に失敗しました');
    }
    setTags(data || []);
    setLoading(false);
  };

  useEffect(() => { loadTags(); }, []);

  const handleCreate = async () => {
    if (!newTag.name.trim()) {
      toast.error('タグ名を入力してください');
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('ログインが必要です');
      return;
    }
    const { error } = await (supabase as any).from('tags').insert({
      name: newTag.name.trim(),
      color: newTag.color?.trim() || null,
      description: newTag.description?.trim() || null,
      user_id: user.id,
    });
    if (error) {
      console.error(error);
      toast.error('作成に失敗しました');
    } else {
      toast.success('タグを作成しました');
      setNewTag({ name: "", color: "", description: "" });
      setCreating(false);
      loadTags();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('このタグを削除しますか？')) return;
    const { error } = await (supabase as any).from('tags').delete().eq('id', id);
    if (error) {
      console.error(error);
      toast.error('削除に失敗しました');
    } else {
      toast.success('削除しました');
      setTags(prev => prev.filter(t => t.id !== id));
    }
  };

  const startEdit = (tag: TagRow) => {
    setEditingId(tag.id);
    setEditValues({ name: tag.name, color: tag.color || "", description: tag.description || "" });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (id: string) => {
    const { error } = await (supabase as any).from('tags').update({
      name: editValues.name.trim(),
      color: editValues.color?.trim() || null,
      description: editValues.description?.trim() || null,
    }).eq('id', id);
    if (error) {
      console.error(error);
      toast.error('更新に失敗しました');
    } else {
      toast.success('更新しました');
      setEditingId(null);
      loadTags();
    }
  };

  return (
    <div className="container mx-auto max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">タグ管理</h1>
        <p className="text-muted-foreground">友だちをセグメントするためのタグを作成・編集できます。</p>
      </header>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>新規タグ</CardTitle>
            <CardDescription>セグメント用のタグを作成します</CardDescription>
          </div>
          {!creating ? (
            <Button onClick={() => setCreating(true)} size="sm">
              <Plus className="mr-2 h-4 w-4" /> 追加
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setCreating(false)}>
              <X className="mr-2 h-4 w-4" /> 閉じる
            </Button>
          )}
        </CardHeader>
        {creating && (
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm">タグ名</label>
              <Input value={newTag.name} onChange={(e) => setNewTag(v => ({ ...v, name: e.target.value }))} placeholder="例）VIP" />
            </div>
            <div className="space-y-2">
              <label className="text-sm">カラー（任意）</label>
              <Input value={newTag.color} onChange={(e) => setNewTag(v => ({ ...v, color: e.target.value }))} placeholder="#4f46e5 または teal 等" />
            </div>
            <div className="space-y-2 sm:col-span-3">
              <label className="text-sm">説明（任意）</label>
              <Textarea value={newTag.description} onChange={(e) => setNewTag(v => ({ ...v, description: e.target.value }))} placeholder="用途など" />
            </div>
            <div className="sm:col-span-3 flex gap-2">
              <Button onClick={handleCreate}>
                <Save className="mr-2 h-4 w-4" /> 作成
              </Button>
              <Button variant="outline" onClick={() => setNewTag({ name: "", color: "", description: "" })}>クリア</Button>
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>タグ一覧</CardTitle>
          <CardDescription>作成済みのタグを管理します</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">読み込み中...</p>
          ) : (
            <div className="space-y-4">
              {sorted.length === 0 && <p className="text-muted-foreground">まだタグがありません</p>}
              {sorted.map((tag) => (
                <div key={tag.id} className="rounded-md border p-4">
                  {editingId === tag.id ? (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Input value={editValues.name} onChange={(e)=>setEditValues(v=>({...v,name:e.target.value}))} />
                      <Input value={editValues.color} onChange={(e)=>setEditValues(v=>({...v,color:e.target.value}))} placeholder="#color or name" />
                      <div className="sm:col-span-3">
                        <Textarea value={editValues.description} onChange={(e)=>setEditValues(v=>({...v,description:e.target.value}))} />
                      </div>
                      <div className="sm:col-span-3 flex gap-2">
                        <Button size="sm" onClick={() => saveEdit(tag.id)}>
                          <Save className="mr-2 h-4 w-4" /> 保存
                        </Button>
                        <Button size="sm" variant="outline" onClick={cancelEdit}>
                          <X className="mr-2 h-4 w-4" /> キャンセル
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{tag.name}</h3>
                          {tag.color && <Badge variant="secondary">{tag.color}</Badge>}
                        </div>
                        {tag.description && (
                          <p className="text-sm text-muted-foreground">{tag.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => startEdit(tag)}>
                          <Pencil className="mr-2 h-4 w-4" /> 編集
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(tag.id)}>
                          <Trash2 className="mr-2 h-4 w-4" /> 削除
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

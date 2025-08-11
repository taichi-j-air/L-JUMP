import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Copy, Link as LinkIcon, Plus, Save, Trash2 } from "lucide-react";

interface FormRow {
  id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  success_message: string | null;
  fields: Array<{ id: string; label: string; name: string; type: string; required?: boolean }>;
  created_at: string;
  updated_at: string;
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

export default function FormsBuilder() {
  useSEO("フォーム作成 | 埋め込み対応", "CMSに埋め込める公開フォームを作成・管理", window.location.href);

  const [forms, setForms] = useState<FormRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [formName, setFormName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [successMessage, setSuccessMessage] = useState("送信ありがとうございました。");
  const [fields, setFields] = useState<FormRow["fields"]>([]);

  const loadForms = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('forms')
      .select('*')
      .order('updated_at', { ascending: false });
    if (error) {
      console.error(error);
      toast.error('フォームの取得に失敗しました');
    }
    setForms((data || []).map((f: any) => ({ ...f, fields: Array.isArray(f.fields) ? f.fields : [] })));
    setLoading(false);
  };

  useEffect(() => { loadForms(); }, []);

  const addField = () => {
    setFields(prev => [...prev, { id: crypto.randomUUID(), label: "", name: "", type: "text", required: false }]);
  };

  const updateField = (id: string, patch: Partial<FormRow["fields"][number]>) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));
  };

  const removeField = (id: string) => {
    setFields(prev => prev.filter(f => f.id !== id));
  };

  const resetCreator = () => {
    setFormName("");
    setDescription("");
    setIsPublic(true);
    setSuccessMessage("送信ありがとうございました。");
    setFields([]);
  };

  const handleCreate = async () => {
    if (!formName.trim()) {
      toast.error('フォーム名を入力してください');
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('ログインが必要です'); return; }

    const cleanFields = fields.map(f => ({ id: f.id, label: f.label.trim(), name: f.name.trim(), type: f.type, required: !!f.required }));
    const { error } = await (supabase as any).from('forms').insert({
      user_id: user.id,
      name: formName.trim(),
      description: description.trim() || null,
      is_public: isPublic,
      success_message: successMessage.trim() || null,
      fields: cleanFields,
    });
    if (error) {
      console.error(error);
      toast.error('作成に失敗しました');
    } else {
      toast.success('フォームを作成しました');
      resetCreator();
      setCreating(false);
      loadForms();
    }
  };

  const copyLink = (id: string) => {
    const url = `${window.location.origin}/form/${id}`;
    navigator.clipboard.writeText(url);
    toast.success('埋め込みURLをコピーしました');
  };

  return (
    <div className="container mx-auto max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">フォーム作成</h1>
        <p className="text-muted-foreground">公開フォームを作成し、CMSへ埋め込みできます。</p>
      </header>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <div>
            <CardTitle>新規フォーム</CardTitle>
            <CardDescription>必要なフィールドを追加して保存します</CardDescription>
          </div>
          <Button size="sm" variant={creating ? "secondary" : "default"} onClick={()=> setCreating(v=>!v)}>
            {creating ? '閉じる' : '作成'}
          </Button>
        </CardHeader>
        {creating && (
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm">フォーム名</label>
                <Input value={formName} onChange={(e)=>setFormName(e.target.value)} placeholder="お問い合わせ など" />
              </div>
              <div className="space-y-2">
                <label className="text-sm">公開設定</label>
                <div className="flex items-center gap-3">
                  <Switch checked={isPublic} onCheckedChange={setIsPublic} />
                  <span className="text-sm text-muted-foreground">公開（URLで閲覧可）</span>
                </div>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="text-sm">説明（任意）</label>
                <Textarea value={description} onChange={(e)=>setDescription(e.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="text-sm">送信成功メッセージ</label>
                <Input value={successMessage} onChange={(e)=>setSuccessMessage(e.target.value)} />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">フィールド</h3>
                <Button size="sm" variant="outline" onClick={addField}>
                  <Plus className="mr-2 h-4 w-4" /> 追加
                </Button>
              </div>

              <div className="space-y-3">
                {fields.length === 0 && <p className="text-sm text-muted-foreground">フィールドがありません</p>}
                {fields.map((f) => (
                  <div key={f.id} className="rounded-md border p-3 grid gap-3 sm:grid-cols-4">
                    <Input className="sm:col-span-1" placeholder="ラベル" value={f.label} onChange={(e)=>updateField(f.id,{label:e.target.value})} />
                    <Input className="sm:col-span-1" placeholder="name" value={f.name} onChange={(e)=>updateField(f.id,{name:e.target.value})} />
                    <Select value={f.type} onValueChange={(v)=>updateField(f.id,{type:v})}>
                      <SelectTrigger className="sm:col-span-1"><SelectValue placeholder="タイプ" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">テキスト</SelectItem>
                        <SelectItem value="email">メール</SelectItem>
                        <SelectItem value="textarea">テキストエリア</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex items-center justify-between sm:col-span-1 gap-2">
                      <label className="text-sm">必須</label>
                      <Switch checked={!!f.required} onCheckedChange={(v)=>updateField(f.id,{required:v})} />
                      <Button size="icon" variant="destructive" onClick={()=>removeField(f.id)} aria-label="フィールド削除">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Button onClick={handleCreate}><Save className="mr-2 h-4 w-4" /> 保存</Button>
                <Button variant="outline" onClick={resetCreator}>クリア</Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>フォーム一覧</CardTitle>
          <CardDescription>作成済みフォームのリンクをコピーできます</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">読み込み中...</p>
          ) : (
            <div className="space-y-3">
              {forms.length === 0 && <p className="text-muted-foreground">まだフォームがありません</p>}
              {forms.map((f) => (
                <div key={f.id} className="rounded-md border p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="font-medium">{f.name}</h3>
                    {f.description && <p className="text-sm text-muted-foreground">{f.description}</p>}
                    <p className="text-xs text-muted-foreground">フィールド数: {f.fields?.length || 0} / 公開: {f.is_public ? 'はい' : 'いいえ'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={()=>copyLink(f.id)}>
                      <Copy className="mr-2 h-4 w-4" /> 埋め込みURL
                    </Button>
                    <a href={`/form/${f.id}`} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline">
                        <LinkIcon className="mr-2 h-4 w-4" /> 公開ページ
                      </Button>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

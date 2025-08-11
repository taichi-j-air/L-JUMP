import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface FormRow {
  id: string;
  name: string;
}

export default function FormResponses() {
  useEffect(() => {
    document.title = "回答結果 | フォーム";
  }, []);

  const [forms, setForms] = useState<FormRow[]>([]);
  const [selectedForm, setSelectedForm] = useState<string>("");
  const [submissions, setSubmissions] = useState<Array<{ id: string; submitted_at: string; data: any; friend_id: string | null }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadForms = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await (supabase as any)
        .from('forms')
        .select('id,name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) {
        console.error(error);
        toast.error('フォームの取得に失敗しました');
        return;
      }
      setForms(data || []);
      if ((data || []).length > 0) {
        setSelectedForm(data![0].id);
      }
    };
    loadForms();
  }, []);

  useEffect(() => {
    const loadSubmissions = async () => {
      if (!selectedForm) return;
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from('form_submissions')
        .select('id, submitted_at, data, friend_id')
        .eq('form_id', selectedForm)
        .order('submitted_at', { ascending: false });
      if (error) {
        console.error(error);
        toast.error('回答の取得に失敗しました');
      }
      setSubmissions(data || []);
      setLoading(false);
    };
    loadSubmissions();
  }, [selectedForm]);

  return (
    <div className="container mx-auto max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">回答結果</h1>
        <p className="text-muted-foreground">フォームごとの回答一覧を確認できます。</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>フォーム選択</CardTitle>
          <CardDescription>結果を確認するフォームを選択してください</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-sm">
            <Select value={selectedForm} onValueChange={setSelectedForm}>
              <SelectTrigger>
                <SelectValue placeholder="フォームを選択" />
              </SelectTrigger>
              <SelectContent>
                {forms.map(f => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <p className="text-muted-foreground">読み込み中...</p>
          ) : (
            <div className="space-y-3">
              {submissions.length === 0 ? (
                <p className="text-muted-foreground">まだ回答はありません</p>
              ) : (
                submissions.map((s) => (
                  <div key={s.id} className="rounded-md border p-4">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>提出日時: {new Date(s.submitted_at).toLocaleString()}</span>
                      <span>{s.friend_id ? `友だちID: ${s.friend_id}` : '匿名'}</span>
                    </div>
                    <pre className="mt-2 text-sm whitespace-pre-wrap break-words">{JSON.stringify(s.data, null, 2)}</pre>
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

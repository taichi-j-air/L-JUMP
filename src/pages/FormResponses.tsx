import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import FormListTable from "@/components/forms/FormListTable";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface FormRow {
  id: string;
  name: string;
  description?: string | null;
  fields?: Array<{ id: string; label: string; name: string; type: string }>;
}

export default function FormResponses() {
  useEffect(() => {
    document.title = "回答結果 | フォーム";
  }, []);

  const [forms, setForms] = useState<FormRow[]>([]);
  const [selectedForm, setSelectedForm] = useState<string>("");
  const [submissions, setSubmissions] = useState<Array<{ id: string; submitted_at: string; data: any; friend_id: string | null; form_id?: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const navigate = useNavigate();
  useEffect(() => {
    const loadForms = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await (supabase as any)
        .from('forms')
        .select('id,name,description,fields')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) {
        console.error(error);
        toast.error('フォームの取得に失敗しました');
        return;
      }
      const items = (data || []).map((d: any) => ({ ...d, fields: Array.isArray(d.fields) ? d.fields : [] }))
      setForms(items || []);
      if ((items || []).length > 0) {
        setSelectedForm(items![0].id);
      }
      // load unread from storage
      try {
        const raw = localStorage.getItem('unreadResponses');
        setUnreadCounts(raw ? JSON.parse(raw) : {});
        // clear global badge when opening page
        localStorage.setItem('unreadResponsesGlobal', 'false');
        window.dispatchEvent(new Event('unread-responses-updated'));
      } catch {}
    };
    loadForms();
  }, []);

  useEffect(() => {
    const loadSubmissions = async () => {
      if (!selectedForm) return;
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from('form_submissions')
        .select('id, submitted_at, data, friend_id, form_id')
        .eq('form_id', selectedForm)
        .order('submitted_at', { ascending: false });
      if (error) {
        console.error(error);
        toast.error('回答の取得に失敗しました');
      }
      setSubmissions(data || []);
      setLoading(false);

      // Clear unread count for this form when opened
      try {
        const raw = localStorage.getItem('unreadResponses');
        const map: Record<string, number> = raw ? JSON.parse(raw) : {};
        if (map[selectedForm]) {
          map[selectedForm] = 0;
          localStorage.setItem('unreadResponses', JSON.stringify(map));
          window.dispatchEvent(new Event('unread-responses-updated'));
          setUnreadCounts(map);
        }
      } catch {}
    };
    loadSubmissions();
  }, [selectedForm]);

  // Realtime update: append new submission if it belongs to the selected form
  useEffect(() => {
    const channel = supabase
      .channel('form_responses_live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'form_submissions' }, (payload: any) => {
        const row = payload?.new
        if (row?.form_id === selectedForm) {
          setSubmissions(prev => [{ id: row.id, submitted_at: row.submitted_at, data: row.data, friend_id: row.friend_id, form_id: row.form_id }, ...prev])
        }
      })
      .subscribe()
    const handleUnreadUpdate = () => {
      try {
        const raw = localStorage.getItem('unreadResponses')
        setUnreadCounts(raw ? JSON.parse(raw) : {})
      } catch {}
    }
    window.addEventListener('unread-responses-updated', handleUnreadUpdate)
    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('unread-responses-updated', handleUnreadUpdate)
    }
  }, [selectedForm])

  const selectedFormObj = useMemo(() => forms.find(f => f.id === selectedForm) || null, [forms, selectedForm]);

  const fieldOrder = selectedFormObj?.fields || [];

  const renderValue = (type: string | undefined, value: any) => {
    if (Array.isArray(value)) return value.join(', ');
    if (value === null || value === undefined) return '';
    return String(value);
  }

  return (
    <div className="container mx-auto max-w-7xl space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">回答結果</h1>
        <p className="text-muted-foreground">フォームごとの回答一覧を確認できます。</p>
      </header>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-5 lg:col-span-4">
          <FormListTable
            items={forms}
            loading={false}
            selectedId={selectedForm || null}
            onSelect={setSelectedForm}
            unreadCounts={unreadCounts}
          />
        </div>

        <div className="col-span-12 md:col-span-7 lg:col-span-8 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{selectedFormObj?.name || 'フォーム選択'}</CardTitle>
              {selectedFormObj?.description && <CardDescription>{selectedFormObj.description}</CardDescription>}
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground">読み込み中...</p>
              ) : submissions.length === 0 ? (
                <p className="text-muted-foreground">まだ回答はありません</p>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">提出日時</TableHead>
                        <TableHead className="whitespace-nowrap">友だち</TableHead>
                        {fieldOrder.map((f) => (
                          <TableHead key={f.id} className="whitespace-nowrap">{f.label}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {submissions.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="align-top whitespace-nowrap text-xs text-muted-foreground">{new Date(s.submitted_at).toLocaleString()}</TableCell>
                          <TableCell className="align-top whitespace-nowrap text-xs text-muted-foreground">{s.friend_id ? s.friend_id : '匿名'}</TableCell>
                          {fieldOrder.map((f) => {
                            const val = s.data?.[f.name]
                            const text = renderValue(f.type, val)
                            return (
                              <TableCell key={f.id} className="align-top text-sm break-words max-w-[320px]">{text}</TableCell>
                            )
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

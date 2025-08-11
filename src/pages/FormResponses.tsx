import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import FormListTable from "@/components/forms/FormListTable";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

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
  const [badgeEnabledMap, setBadgeEnabledMap] = useState<Record<string, boolean>>({});
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
        const enabledRaw = localStorage.getItem('formBadgeEnabled');
        setBadgeEnabledMap(enabledRaw ? JSON.parse(enabledRaw) : {});
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
            badgeEnabledMap={badgeEnabledMap}
            onToggleBadge={(id) => {
              setBadgeEnabledMap((prev) => {
                const enabled = prev[id] !== false
                const next = { ...prev, [id]: !enabled }
                localStorage.setItem('formBadgeEnabled', JSON.stringify(next))
                window.dispatchEvent(new Event('unread-responses-updated'))
                return next
              })
            }}
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
                <div className="rounded-md border">
                  <Accordion type="multiple" className="w-full">
                    {submissions.map((s) => (
                      <AccordionItem key={s.id} value={s.id}>
                        <AccordionTrigger className="text-left">
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(s.submitted_at).toLocaleString()}</span>
                            <span className="text-xs text-muted-foreground">{s.friend_id ? s.friend_id : '匿名'}</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {fieldOrder.map((f) => {
                              const val = s.data?.[f.name]
                              const text = renderValue(f.type, val)
                              return (
                                <div key={f.id} className="space-y-1">
                                  <div className="text-xs text-muted-foreground">{f.label}</div>
                                  <div className="text-sm break-words">{text}</div>
                                </div>
                              )
                            })}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

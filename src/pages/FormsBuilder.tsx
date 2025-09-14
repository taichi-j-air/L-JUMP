import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
// Switch は右カラムでは使わないが、FormListPanel 内で使うためここでの import はそのままでもOK
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Save } from "lucide-react";
import FormFieldList from "@/components/forms/FormFieldList";
import FieldEditorPanel from "@/components/forms/FieldEditorPanel";
import FormPreviewPanel from "@/components/forms/FormPreviewPanel";
import FormListPanel from "@/components/forms/FormListPanel";
import { FormShareDialog } from "@/components/FormShareDialog";

interface FormRow {
  id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  success_message: string | null;
  success_message_mode?: string;
  success_message_plain?: string | null;
  success_message_template_id?: string | null;
  submit_button_text?: string | null;
  submit_button_variant?: string | null;
  submit_button_bg_color?: string | null;
  submit_button_text_color?: string | null;
  accent_color?: string | null;
  require_line_friend?: boolean;
  prevent_duplicate_per_friend?: boolean;
  post_submit_scenario_id?: string | null;
  fields: Array<{ id: string; label: string; name: string; type: string; required?: boolean; options?: string[]; placeholder?: string; rows?: number }>;
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
  const [formName, setFormName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  // Success message state
  const [successMessageMode, setSuccessMessageMode] = useState<'plain' | 'rich'>('plain');
  const [successMessagePlain, setSuccessMessagePlain] = useState("送信ありがとうございました。");
  const [successMessageTemplateId, setSuccessMessageTemplateId] = useState<string | null>(null);

  const [fields, setFields] = useState<FormRow["fields"]>([]);
  const [requireLineFriend, setRequireLineFriend] = useState(false);
  const [preventDuplicate, setPreventDuplicate] = useState(false);
  const [postScenario, setPostScenario] = useState<string | null>(null);
  const [scenarios, setScenarios] = useState<Array<{ id: string; name: string }>>([]);
  const [submitButtonText, setSubmitButtonText] = useState<string>("送信");
  const [submitButtonVariant, setSubmitButtonVariant] = useState<string>("default");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [submitButtonBgColor, setSubmitButtonBgColor] = useState<string>("#0cb386");
  const [submitButtonTextColor, setSubmitButtonTextColor] = useState<string>("#ffffff");
  const [accentColor, setAccentColor] = useState<string>("#0cb386");
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [selectedFormForShare, setSelectedFormForShare] = useState<{id: string, name: string} | null>(null);

  const loadForms = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setForms([]);
      setLoading(false);
      return;
    }
    const { data, error } = await (supabase as any)
      .from('forms')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    if (error) {
      console.error(error);
      toast.error('フォームの取得に失敗しました');
    }
    setForms((data || []).map((f: any) => ({ ...f, fields: Array.isArray(f.fields) ? f.fields : [] })));
    setLoading(false);
  };

  useEffect(() => { loadForms(); }, []);

  // 回答未読バッジ（ローカルストレージから同期）
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    const sync = () => {
      try {
        const raw = localStorage.getItem('unreadResponses');
        setUnreadCounts(raw ? JSON.parse(raw) : {});
      } catch {}
    };
    sync();
    window.addEventListener('unread-responses-updated', sync);
    return () => window.removeEventListener('unread-responses-updated', sync);
  }, []);

  useEffect(() => {
    const loadScenarios = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setScenarios([]); return; }
      const { data, error } = await (supabase as any)
        .from('step_scenarios')
        .select('id,name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      if (!error) setScenarios(data || []);
    };
    loadScenarios();
  }, []);

  useEffect(() => {
    if (!requireLineFriend && preventDuplicate) {
      setPreventDuplicate(false);
    }
  }, [requireLineFriend, preventDuplicate]);

  const addField = () => {
    const id = crypto.randomUUID();
    setFields(prev => [...prev, { id, label: "", name: `field_${id.slice(0,8)}`, type: "textarea", required: false }]);
    setSelectedFieldId(id);
  };

  const updateField = (id: string, patch: Partial<FormRow["fields"][number]>) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));
  };

  const removeField = (id: string) => {
    setFields(prev => prev.filter(f => f.id !== id));
    setSelectedFieldId((prev) => (prev === id ? null : prev));
  };

  const selectedField = useMemo(() => fields.find(f => f.id === selectedFieldId) ?? null, [fields, selectedFieldId]);

  const resetCreator = () => {
    setFormName("");
    setDescription("");
    setIsPublic(false);
    setSuccessMessageMode('plain');
    setSuccessMessagePlain("送信ありがとうございました。");
    setSuccessMessageTemplateId(null);
    setFields([]);
    setRequireLineFriend(false);
    setPreventDuplicate(false);
    setPostScenario(null);
    setSubmitButtonText("送信");
    setSubmitButtonVariant("default");
    setSubmitButtonBgColor("#0cb386");
    setSubmitButtonTextColor("#ffffff");
    setAccentColor("#0cb386");
    setEditingId(null);
  };

  // Helper: 成功メッセージ最終値
  const getFinalSuccessMessage = async (): Promise<string> => {
    if (successMessageMode === 'plain') return successMessagePlain;

    if (successMessageMode === 'rich' && successMessageTemplateId) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return successMessagePlain;

        const { data } = await supabase
          .from('success_message_templates')
          .select('content_html')
          .eq('id', successMessageTemplateId)
          .eq('user_id', user.id)
          .single();

        return data?.content_html || successMessagePlain;
      } catch {
        return successMessagePlain;
      }
    }
    return successMessagePlain;
  };

  const handleCreate = async () => {
    if (!formName.trim()) {
      toast.error('フォーム名を入力してください');
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('ログインが必要です'); return; }

    const cleanFields = fields.map(f => ({
      id: f.id,
      label: f.label.trim(),
      name: f.name.trim(),
      type: f.type,
      required: !!f.required,
      options: Array.isArray(f.options) ? f.options : undefined,
      placeholder: f.placeholder?.trim() || undefined,
      rows: f.rows ? Number(f.rows) : undefined
    }));

    const finalSuccessMessage = await getFinalSuccessMessage();

    const { data: created, error } = await (supabase as any)
      .from('forms')
      .insert({
        user_id: user.id,
        name: formName.trim(),
        description: description.trim() || null,
        is_public: isPublic,
        success_message: finalSuccessMessage,
        success_message_mode: successMessageMode,
        success_message_plain: successMessagePlain,
        success_message_template_id: successMessageTemplateId,
        fields: cleanFields,
        require_line_friend: requireLineFriend,
        prevent_duplicate_per_friend: preventDuplicate,
        post_submit_scenario_id: postScenario,
        submit_button_text: submitButtonText,
        submit_button_variant: 'default',
        submit_button_bg_color: submitButtonBgColor,
        submit_button_text_color: submitButtonTextColor,
        accent_color: accentColor,
      })
      .select('id')
      .single();

    if (error) {
      console.error(error);
      toast.error('作成に失敗しました');
    } else {
      toast.success('フォームを作成しました');
      if (created?.id) setEditingId(created.id);
      await loadForms();
    }
  };

  const deleteForm = async (formId: string) => {
    const { error } = await (supabase as any).functions.invoke('delete-form', { body: { form_id: formId } });
    if (error) {
      console.error(error);
      toast.error('削除に失敗しました');
    } else {
      toast.success('フォームを削除しました');
      loadForms();
    }
  };

  const startEdit = (f: FormRow) => {
    setEditingId(f.id);
    setFormName(f.name);
    setDescription(f.description || "");
    setIsPublic(!!f.is_public);

    setSuccessMessageMode(f.success_message_mode === 'rich' ? 'rich' : 'plain');
    setSuccessMessagePlain(f.success_message_plain || f.success_message || "送信ありがとうございました。");
    setSuccessMessageTemplateId(f.success_message_template_id || null);

    const normalized = Array.isArray(f.fields) ? f.fields : [];
    setFields(normalized);
    setSelectedFieldId(normalized[0]?.id ?? null);
    setRequireLineFriend(f.require_line_friend ?? false);
    setPreventDuplicate(f.prevent_duplicate_per_friend ?? false);
    setPostScenario(f.post_submit_scenario_id ?? null);
    setSubmitButtonText(f.submit_button_text || "送信");
    setSubmitButtonVariant('default');
    setSubmitButtonBgColor(f.submit_button_bg_color || "#0cb386");
    setSubmitButtonTextColor(f.submit_button_text_color || "#ffffff");
    setAccentColor(f.accent_color || "#0cb386");
  };

  const copyLink = (id: string) => {
    const url = `${window.location.origin}/form/${id}?uid=[UID]`;
    navigator.clipboard.writeText(url);
    toast.success('パラメーター付きURLをコピーしました');
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    if (!formName.trim()) { toast.error('フォーム名を入力してください'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('ログインが必要です'); return; }

    const cleanFields = fields.map(f => ({
      id: f.id,
      label: f.label.trim(),
      name: f.name.trim(),
      type: f.type,
      required: !!f.required,
      options: Array.isArray(f.options) ? f.options : undefined,
      placeholder: f.placeholder?.trim() || undefined,
      rows: f.rows ? Number(f.rows) : undefined
    }));

    const finalSuccessMessage = await getFinalSuccessMessage();

    const { error } = await (supabase as any)
      .from('forms')
      .update({
        name: formName.trim(),
        description: description.trim() || null,
        is_public: isPublic,
        success_message: finalSuccessMessage,
        success_message_mode: successMessageMode,
        success_message_plain: successMessagePlain,
        success_message_template_id: successMessageTemplateId,
        fields: cleanFields,
        require_line_friend: requireLineFriend,
        prevent_duplicate_per_friend: preventDuplicate,
        post_submit_scenario_id: postScenario,
        submit_button_text: submitButtonText,
        submit_button_variant: 'default',
        submit_button_bg_color: submitButtonBgColor,
        submit_button_text_color: submitButtonTextColor,
        accent_color: accentColor,
      })
      .eq('id', editingId);

    if (error) {
      console.error(error);
      toast.error('更新に失敗しました');
    } else {
      toast.success('フォームを更新しました');
      await loadForms();
    }
  };

  return (
    <div className="container mx-auto max-w-7xl space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">フォーム作成</h1>
        <p className="text-muted-foreground">公開フォームを作成し、ブラウザへ埋め込みできます。</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* 左: フォーム一覧（ここに公開トグルを移動） */}
        <div className="lg:col-span-4 space-y-2">
          <FormListPanel
            items={forms as any}
            loading={loading}
            selectedId={editingId}
            onSelect={(id) => {
              const f = forms.find((x) => x.id === id);
              if (f) startEdit(f);
            }}
            onAddNew={async () => {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) { toast.error('ログインが必要です'); return; }

              const getFinalMessage = async (): Promise<string> => {
                if (successMessageMode === 'plain') return successMessagePlain;
                if (successMessageMode === 'rich' && successMessageTemplateId) {
                  try {
                    const { data } = await supabase
                      .from('success_message_templates')
                      .select('content_html')
                      .eq('id', successMessageTemplateId)
                      .eq('user_id', user.id)
                      .single();
                    return data?.content_html || successMessagePlain;
                  } catch {
                    return successMessagePlain;
                  }
                }
                return successMessagePlain;
              };

              const finalMessage = await getFinalMessage();

              const { data, error } = await (supabase as any)
                .from('forms')
                .insert({
                  user_id: user.id,
                  name: '無題のフォーム',
                  description: null,
                  is_public: false,
                  success_message: finalMessage,
                  success_message_mode: 'plain',
                  success_message_plain: '送信ありがとうございました。',
                  success_message_template_id: null,
                  fields: [],
                  require_line_friend: false,
                  prevent_duplicate_per_friend: false,
                  post_submit_scenario_id: null,
                  submit_button_text: '送信',
                  submit_button_variant: 'default',
                  submit_button_bg_color: '#0cb386',
                  submit_button_text_color: '#ffffff',
                  accent_color: '#0cb386',
                })
                .select('*')
                .single();

              if (error || !data) {
                console.error(error);
                toast.error('フォームの作成に失敗しました');
                return;
              }
              await loadForms();
              const created = { ...data, fields: Array.isArray(data.fields) ? data.fields : [] } as any;
              startEdit(created);
            }}
            onCopyLink={copyLink}
            onOpenPublic={(id) => window.open(`/form/${id}`, '_blank', 'noopener,noreferrer')}
            onDelete={deleteForm}
            unreadCounts={unreadCounts}
            // ★追加: 公開/非公開トグルのハンドラ
            onTogglePublic={async (id, checked) => {
              try {
                const { error } = await supabase.from("forms").update({ is_public: checked }).eq("id", id);
                if (error) throw error;
                // 選択中のフォームならローカル state も同期
                if (editingId === id) setIsPublic(checked);
                await loadForms();
                toast.success(`フォームを${checked ? "公開" : "非公開"}にしました`);
              } catch (e) {
                console.error(e);
                toast.error("公開状態の更新に失敗しました");
              }
            }}
          />
          <div className="text-xs text-muted-foreground">
            削除するとフォームと回答データは完全に削除され、元に戻せません。
          </div>
        </div>

        {/* 中央: 項目設定 */}
        <div className="lg:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">項目設定</CardTitle>
              <CardDescription className="text-xs">
                テキストエリア/選択肢/タイトルなどのフィールドを管理します
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">フォーム名</Label>
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="フォーム名を入力" />
              </div>

              <FormFieldList
                fields={fields as any}
                selectedId={selectedFieldId}
                onSelect={setSelectedFieldId}
                onAdd={addField}
                onRemove={removeField}
                onReorder={(orderedIds) => {
                  setFields((prev) => {
                    const map = new Map(prev.map(f => [f.id, f] as const));
                    return orderedIds.map(id => map.get(id)!).filter(Boolean) as typeof prev;
                  });
                }}
                rightActions={
                  <Button size="sm" onClick={editingId ? handleUpdate : handleCreate}>
                    <Save className="mr-2 h-4 w-4" /> 保存
                  </Button>
                }
              />

              <FieldEditorPanel
                key={`${editingId || 'new'}:${selectedFieldId || 'none'}`}
                field={selectedField as any}
                onChange={(patch) => selectedField && updateField(selectedField.id, patch)}
              />
            </CardContent>
          </Card>
        </div>

        {/* 右: プレビュー + 設定（公開トグルは撤去済み） */}
        <div className="lg:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">プレビューと設定</CardTitle>
            </CardHeader>
            <CardContent>
              <FormPreviewPanel
                key={editingId || 'new'}
                formName={formName}
                setFormName={setFormName}
                description={description}
                setDescription={setDescription}
                fields={fields as any}
                submitButtonText={submitButtonText}
                setSubmitButtonText={setSubmitButtonText}
                submitButtonVariant={submitButtonVariant}
                setSubmitButtonVariant={setSubmitButtonVariant}
                submitButtonBgColor={submitButtonBgColor}
                setSubmitButtonBgColor={setSubmitButtonBgColor}
                submitButtonTextColor={submitButtonTextColor}
                setSubmitButtonTextColor={setSubmitButtonTextColor}
                accentColor={accentColor}
                setAccentColor={setAccentColor}
                successMessageMode={successMessageMode}
                setSuccessMessageMode={setSuccessMessageMode}
                successMessagePlain={successMessagePlain}
                setSuccessMessagePlain={setSuccessMessagePlain}
                successMessageTemplateId={successMessageTemplateId}
                setSuccessMessageTemplateId={setSuccessMessageTemplateId}
                requireLineFriend={requireLineFriend}
                setRequireLineFriend={setRequireLineFriend}
                preventDuplicate={preventDuplicate}
                setPreventDuplicate={setPreventDuplicate}
                postScenario={postScenario}
                setPostScenario={setPostScenario}
                scenarios={scenarios}
                formId={editingId || 'new'}
                onSave={editingId ? handleUpdate : handleCreate}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {selectedFormForShare && (
        <FormShareDialog
          open={showShareDialog}
          onOpenChange={setShowShareDialog}
          formId={selectedFormForShare.id}
          formName={selectedFormForShare.name}
        />
      )}
    </div>
  );
}

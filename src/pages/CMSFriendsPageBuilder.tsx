import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ColorPicker } from "@/components/ui/color-picker";
import RichTextEditor from "@/components/RichTextEditor";
import RichTextBlocksEditor from "@/components/RichTextBlocksEditor";
import { TimerPreview } from "@/components/TimerPreview";
import { useLiffValidation } from "@/hooks/useLiffValidation";
import { Trash2, GripVertical, FileText, FormInput } from "lucide-react";

// 【追加】フォームブロックの型定義
interface FormBlock {
  id: string;
  type: 'form';
  title: string;
  formId: string;
  formName: string;
}

// 【修正】既存の型定義
interface CmsPageRow {
  id: string;
  user_id: string;
  title: string;
  slug: string;
  share_code: string;
  visibility: "friends_only" | "public" | "private";
  internal_name?: string | null;
  tag_label?: string | null;
  content_blocks?: any[];
  form_blocks?: FormBlock[]; // 【追加】フォーム専用ブロック
  allowed_tag_ids?: string[];
  blocked_tag_ids?: string[];
  require_passcode?: boolean;
  passcode?: string | null;
  timer_enabled?: boolean;
  timer_deadline?: string | null;
  timer_display_mode?: string;
  internal_timer?: boolean;
  timer_text?: string | null;
  expire_action?: string;
}

interface TagRow { id: string; name: string }

export default function CMSFriendsPageBuilder() {
  const [pages, setPages] = useState<CmsPageRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => pages.find(p => p.id === selectedId) || null, [pages, selectedId]);
  const { hasLiffConfig } = useLiffValidation();

  // 既存のstateは変更なし
  const [internalName, setInternalName] = useState("");
  const [tagLabel, setTagLabel] = useState("");
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [contentHtml, setContentHtml] = useState<string>("");
  const [contentBlocks, setContentBlocks] = useState<string[]>([]);
  
  // 【追加】フォームブロック専用のstate
  const [formBlocks, setFormBlocks] = useState<FormBlock[]>([]);

  // 他のstateは変更なし（省略）
  const [tags, setTags] = useState<TagRow[]>([]);
  const [allowedTags, setAllowedTags] = useState<string[]>([]);
  const [blockedTags, setBlockedTags] = useState<string[]>([]);
  const [requirePass, setRequirePass] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerMode, setTimerMode] = useState<"absolute" | "per_access">("absolute");
  const [timerDeadline, setTimerDeadline] = useState("");
  const [durationSeconds, setDurationSeconds] = useState<number>(0);
  const [showMilliseconds, setShowMilliseconds] = useState<boolean>(false);
  const [timerStyle, setTimerStyle] = useState<"solid" | "glass" | "outline">("solid");
  const [timerBgColor, setTimerBgColor] = useState<string>("#0cb386");
  const [timerTextColor, setTimerTextColor] = useState<string>("#ffffff");
  const [internalTimer, setInternalTimer] = useState(false);
  const [timerText, setTimerText] = useState("");
  const [expireAction, setExpireAction] = useState<"hide" | "keep_public">("keep_public");
  const [dayLabel, setDayLabel] = useState<string>("日");
  const [hourLabel, setHourLabel] = useState<string>("時間");
  const [minuteLabel, setMinuteLabel] = useState<string>("分");
  const [secondLabel, setSecondLabel] = useState<string>("秒");
  const [durDays, setDurDays] = useState<number>(0);
  const [durHours, setDurHours] = useState<number>(0);
  const [durMinutes, setDurMinutes] = useState<number>(0);
  const [durSecs, setDurSecs] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [forms, setForms] = useState<Array<{id: string; name: string}>>([]);

  // 【追加】フォームブロック管理関数
  const addFormBlock = () => {
    const newBlock: FormBlock = {
      id: `form_${Date.now()}`,
      type: 'form',
      title: '新しいフォーム',
      formId: '',
      formName: ''
    };
    setFormBlocks(prev => [...prev, newBlock]);
  };

  const updateFormBlock = (index: number, updates: Partial<FormBlock>) => {
    setFormBlocks(prev => prev.map((block, i) => 
      i === index ? { ...block, ...updates } : block
    ));
  };

  const deleteFormBlock = (index: number) => {
    setFormBlocks(prev => prev.filter((_, i) => i !== index));
  };

  const openPreview = () => {
    if (!selected) return;
    const previewUrl = `/cms/friends-public/${selected.share_code}/${selected.id}`;
    window.open(previewUrl, '_blank');
  };

  // 既存のuseEffectやその他の関数は変更なし（省略）
  useEffect(() => {
    document.title = "LINE友達ページ作成 | CMS";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', 'LINE友達限定ページを3カラム編集で作成・管理できます。');
  }, []);

  useEffect(() => {
    // Load pages and tags
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return toast.error("ログインが必要です");

      const { data: tagRows, error: tagErr } = await (supabase as any)
        .from('tags')
        .select('id,name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (!tagErr) setTags(tagRows || []);

      const { data: formRows } = await (supabase as any)
        .from('forms')
        .select('id, name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setForms(formRows || []);

      const { data: pageRows, error } = await (supabase as any)
        .from('cms_pages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) {
        console.error(error);
        toast.error("ページの取得に失敗しました");
        return;
      }
      const arr: CmsPageRow[] = (pageRows || []).map((r: any) => ({
        ...r,
        content_blocks: Array.isArray(r.content_blocks) ? r.content_blocks : [],
        form_blocks: Array.isArray(r.form_blocks) ? r.form_blocks : [], // 【追加】
        allowed_tag_ids: Array.isArray(r.allowed_tag_ids) ? r.allowed_tag_ids : [],
        blocked_tag_ids: Array.isArray(r.blocked_tag_ids) ? r.blocked_tag_ids : [],
      }));
      setPages(arr);
      if (arr.length > 0) setSelectedId(arr[0].id);
    };
    load();
  }, []);

  // 【修正】選択されたページが変更された時の処理
  useEffect(() => {
    if (!selected) return;
    // 既存の処理は変更なし
    setInternalName(selected.internal_name || selected.title || "");
    setTagLabel(selected.tag_label || "");
    setSlug(selected.slug || "");
    setTitle(selected.title || "");
    setContentHtml((selected as any).content || "");
    setContentBlocks(Array.isArray((selected as any).content_blocks) ? (selected as any).content_blocks : []);
    
    // 【追加】フォームブロックの読み込み
    setFormBlocks(Array.isArray(selected.form_blocks) ? selected.form_blocks : []);
    
    // 他の既存処理は変更なし（省略）
    setAllowedTags(selected.allowed_tag_ids || []);
    setBlockedTags(selected.blocked_tag_ids || []);
    setRequirePass(!!selected.require_passcode);
    setPasscode(selected.passcode || "");
    setTimerEnabled(!!selected.timer_enabled);
    setIsPublic(selected.visibility === 'friends_only');
  }, [selectedId]);

  // 【修正】保存処理
  const handleSave = async () => {
    if (!selected) return;
    if (!title || !slug) {
      toast.error("ページ名とスラッグは必須です");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title,
        slug,
        internal_name: internalName,
        tag_label: tagLabel,
        visibility: isPublic ? 'friends_only' : 'private',
        content: contentHtml,
        content_blocks: contentBlocks,
        form_blocks: formBlocks, // 【追加】フォームブロックを保存
        // その他の既存フィールドは変更なし（省略）
        allowed_tag_ids: allowedTags,
        blocked_tag_ids: blockedTags,
        require_passcode: requirePass,
        passcode: requirePass ? (passcode || null) : null,
        timer_enabled: timerEnabled,
        // 他の設定も省略
      };

      const { data, error } = await (supabase as any)
        .from('cms_pages')
        .update(payload)
        .eq('id', selected.id)
        .select('*')
        .maybeSingle();
      if (error) throw error;

      setPages(prev => prev.map(p => (p.id === selected.id ? { ...(p as any), ...(data as any) } : p)) as any);
      toast.success("保存しました");
      return Promise.resolve();
    } catch (e: any) {
      console.error(e);
      toast.error("保存に失敗しました");
      return Promise.reject(e);
    } finally {
      setSaving(false);
    }
  };

  // 他の関数は変更なし（省略）

  return (
    <div className="container mx-auto max-w-[1200px] space-y-4">
      {/* 左カラムと右カラムは変更なし（省略） */}

      {/* 中央カラム：ページ情報 + ビルダー */}
      <div className="col-span-12 md:col-span-6 space-y-4">
        {/* ページ情報は変更なし（省略） */}

        <Card>
          <CardHeader className="py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">ページ用コンテンツ作成ビルダー</CardTitle>
              <Button size="sm" variant="secondary" onClick={openPreview} disabled={!selected}>プレビュー</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selected ? (
              <p className="text-sm text-muted-foreground">ページを選択してください。</p>
            ) : (
              <>
                {/* タイマープレビューは変更なし（省略） */}
                
                {/* 【変更なし】リッチテキストエディター */}
                <div className="space-y-2">
                  <Label>本文（リッチテキスト・複数可）</Label>
                  <RichTextBlocksEditor value={contentBlocks} onChange={setContentBlocks} />
                </div>
                
                {/* 【新規追加】フォームブロック管理セクション */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>フォーム埋め込み</Label>
                    <Button size="sm" onClick={addFormBlock}>
                      フォーム追加
                    </Button>
                  </div>
                  
                  {formBlocks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">フォームを追加してください</p>
                  ) : (
                    <div className="space-y-3">
                      {formBlocks.map((block, index) => (
                        <Card key={block.id} className="border-l-4 border-l-green-500">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <FormInput className="h-4 w-4" />
                                <span className="font-medium">フォーム #{index + 1}</span>
                                <span className="text-sm text-muted-foreground">
                                  {block.formName || '（未選択）'}
                                </span>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteFormBlock(index)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            
                            <div className="grid grid-cols-1 gap-3">
                              <div className="space-y-2">
                                <Label>ブロックタイトル</Label>
                                <Input
                                  value={block.title}
                                  onChange={(e) => updateFormBlock(index, { title: e.target.value })}
                                  placeholder="例: お問い合わせフォーム"
                                />
                              </div>
                              
                              <div className="space-y-2">
                                <Label>埋め込むフォーム</Label>
                                <Select 
                                  value={block.formId} 
                                  onValueChange={(formId) => {
                                    const selectedForm = forms.find(f => f.id === formId);
                                    updateFormBlock(index, { 
                                      formId, 
                                      formName: selectedForm?.name || '' 
                                    });
                                  }}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="フォームを選択" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {forms.map(form => (
                                      <SelectItem key={form.id} value={form.id}>
                                        {form.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving || !selected}>
            {saving ? '保存中…' : '保存する'}
          </Button>
        </div>
      </div>

      {/* 右カラムは変更なし（省略） */}
    </div>
  );
}

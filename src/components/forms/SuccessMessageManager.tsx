import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/RichTextEditor";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Plus, X, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SuccessTemplate {
  id: string;
  name: string;
  content_html: string;
  created_at: string;
  updated_at: string;
}

interface SuccessMessageManagerProps {
  /** Form mode: 'plain' or 'rich' */
  mode: 'plain' | 'rich';
  setMode: (mode: 'plain' | 'rich') => void;
  
  /** Plain text content */
  plainContent: string;
  setPlainContent: (content: string) => void;
  
  /** Selected template ID for rich mode */
  selectedTemplateId: string | null;
  setSelectedTemplateId: (id: string | null) => void;

  /** 必須: フォームごとのユニークID */
  formId: string;
}

export function SuccessMessageManager({
  mode,
  setMode,
  plainContent,
  setPlainContent,
  selectedTemplateId,
  setSelectedTemplateId,
  formId,
}: SuccessMessageManagerProps) {
  const [showManager, setShowManager] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [templates, setTemplates] = useState<SuccessTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  // エディタ用一時状態
  const [editingTemplate, setEditingTemplate] = useState<SuccessTemplate | null>(null);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateContent, setNewTemplateContent] = useState("");

  // Load templates from Supabase
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('success_message_templates')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading templates:', error);
        toast.error('テンプレートの読み込みに失敗しました');
        return;
      }

      setTemplates(data || []);
    } catch (error) {
      console.error('Error loading templates:', error);
      toast.error('テンプレートの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const saveTemplate = async (templateData: { name: string; content_html: string }, editingId?: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('ログインが必要です');
        return false;
      }

      if (editingId) {
        const { error } = await supabase
          .from('success_message_templates')
          .update({
            name: templateData.name,
            content_html: templateData.content_html,
          })
          .eq('id', editingId)
          .eq('user_id', user.id);

        if (error) throw error;
        toast.success('テンプレートを更新しました');
      } else {
        const { data, error } = await supabase
          .from('success_message_templates')
          .insert({
            user_id: user.id,
            name: templateData.name,
            content_html: templateData.content_html,
          })
          .select()
          .single();

        if (error) throw error;
        toast.success('テンプレートを作成しました');
      }

      await loadTemplates();
      return true;
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('テンプレートの保存に失敗しました');
      return false;
    }
  };

  const deleteTemplate = async (templateId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('success_message_templates')
        .delete()
        .eq('id', templateId)
        .eq('user_id', user.id);

      if (error) throw error;

      // If this template was selected, clear the selection and switch to plain mode
      if (selectedTemplateId === templateId) {
        setSelectedTemplateId(null);
        setMode('plain');
      }

      await loadTemplates();
      toast.success('テンプレートを削除しました');
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('テンプレートの削除に失敗しました');
    }
  };

  const handleCreateNew = () => {
    setEditingTemplate(null);
    setNewTemplateName("");
    setNewTemplateContent("");
    setShowEditor(true);
  };

  const handleEditTemplate = (template: SuccessTemplate) => {
    setEditingTemplate(template);
    setNewTemplateName(template.name);
    setNewTemplateContent(template.content_html);
    setShowEditor(true);
  };

  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim()) {
      toast.error('テンプレート名を入力してください');
      return;
    }

    const success = await saveTemplate(
      { name: newTemplateName.trim(), content_html: newTemplateContent },
      editingTemplate?.id
    );

    if (success) {
      setShowEditor(false);
    }
  };

  const currentSelectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) || null,
    [templates, selectedTemplateId]
  );

  const handleToggleUseTemplate = (template: SuccessTemplate, use: boolean) => {
    if (use) {
      setSelectedTemplateId(template.id);
      setMode('rich');
    } else {
      setSelectedTemplateId(null);
      setMode('plain');
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (confirm('このテンプレートを削除しますか？')) {
      await deleteTemplate(id);
    }
  };

  const handleSwitchMode = (checked: boolean) => {
    const newMode = checked ? 'rich' : 'plain';
    setMode(newMode);

    if (newMode === 'rich' && !selectedTemplateId) {
      // Switch to rich mode but no template selected - show manager
      setShowManager(true);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm">送信成功メッセージ</label>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">リッチエディタ</span>
          <Switch checked={mode === 'rich'} onCheckedChange={handleSwitchMode} />
        </div>
      </div>

      {mode === 'rich' ? (
        <div className="space-y-2">
          {currentSelectedTemplate && (
            <div className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded">
              設定中: {currentSelectedTemplate.name}
            </div>
          )}
          <Button variant="outline" onClick={() => setShowManager(true)} className="w-full">
            テンプレート管理・作成
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            オフにすると、リッチで設定した内容は表示されません（プレーンテキストに戻ります）
          </p>
        </div>
      ) : (
        <Textarea
          value={plainContent}
          onChange={(e) => setPlainContent(e.target.value)}
          rows={3}
          placeholder="送信完了メッセージを入力してください"
        />
      )}

      {/* テンプレート管理ダイアログ */}
      <Dialog open={showManager} onOpenChange={setShowManager}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>回答成功時画面のテンプレート管理</span>
              <div className="flex items-center gap-2">
                <Button onClick={handleCreateNew} size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  新規作成
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowManager(false)}
                  className="text-destructive font-bold hover:bg-destructive/10"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            {loading ? (
              <div className="text-center py-4 text-muted-foreground text-xs">読み込み中...</div>
            ) : templates.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-xs">保存されたテンプレートがありません</div>
            ) : (
              <Table className="text-xs">
                <TableHeader>
                  <TableRow className="h-8">
                    <TableHead className="w-8 text-xs p-2">選択</TableHead>
                    <TableHead className="text-xs p-2">名前</TableHead>
                    <TableHead className="w-20 text-xs p-2">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.id} className="h-8">
                      <TableCell className="p-2">
                        <Switch
                          checked={selectedTemplateId === template.id}
                          onCheckedChange={(checked) => handleToggleUseTemplate(template, checked)}
                          className="scale-75"
                        />
                      </TableCell>
                      <TableCell className="font-medium text-xs p-2">{template.name}</TableCell>
                      <TableCell className="p-2">
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditTemplate(template)}
                            className="h-6 px-2 text-xs"
                          >
                            編集
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteTemplate(template.id)}
                            className="h-6 px-1 bg-destructive text-white hover:bg-destructive/80"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <div className="space-y-3">
              <p className="text-xs text-muted-foreground text-center">
                保存を押さないと設定が保存されません
              </p>
              <div className="flex justify-end gap-2">
                <Button onClick={() => setShowManager(false)} variant="outline" className="h-8 px-4 text-xs">
                  閉じる
                </Button>
                <Button 
                  onClick={() => {
                    // 設定が保存されました（実際の保存はFormsBuilderで実行される）
                    toast.success('設定が保存されました');
                    setShowManager(false);
                  }} 
                  className="h-8 px-4 text-xs"
                >
                  保存
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* テンプレート編集ダイアログ */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "テンプレートを編集" : "新しいテンプレートを作成"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">テンプレート名</label>
              <Input
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="テンプレートの名前を入力"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">メッセージ内容</label>
              <RichTextEditor value={newTemplateContent} onChange={setNewTemplateContent} className="min-h-[300px]" />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowEditor(false)}>
                キャンセル
              </Button>
              <Button onClick={handleSaveTemplate} disabled={!newTemplateName.trim()}>
                {editingTemplate ? "更新" : "新規保存"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

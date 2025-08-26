import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Image, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MediaLibrarySelector } from "@/components/MediaLibrarySelector";
import { FlexMessageSelector } from "@/components/FlexMessageSelector";

interface StepMessage {
  id?: string;
  message_type: "text" | "media" | "flex" | "restore_access";
  content: string;
  media_url?: string | null;
  flex_message_id?: string | null;
  message_order: number;
  restore_config?: {
    type: "button" | "image";
    title?: string;
    button_text?: string;
    target_scenario_id?: string;
    image_url?: string;
  } | null;
}

interface StepMessageEditorProps {
  stepId: string;
  messages: StepMessage[];
  onMessagesChange: (messages: StepMessage[]) => void;
  onPreviewChange?: (previewData: any) => void;
  onEditingMessagesChange?: (editingMessages: StepMessage[]) => void;
  createMessage: (stepId: string) => Promise<any>;
  updateMessage: (id: string, updates: Partial<StepMessage>) => Promise<any>;
}

export default function StepMessageEditor({ 
  stepId, 
  messages, 
  onMessagesChange,
  onPreviewChange,
  onEditingMessagesChange,
  createMessage,
}: StepMessageEditorProps) {
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [flexMessages, setFlexMessages] = useState<any[]>([]);
  
  // ローカル編集状態（保存されるまでは一時的な状態）
  const [editingMessages, setEditingMessages] = useState<StepMessage[]>(messages);
  
  // 各メッセージの保存状態を管理（インデックス単位）
  const [savingStates, setSavingStates] = useState<{ [key: number]: boolean }>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<{ [key: number]: boolean }>({});
  
  // デバウンス用のタイマー参照
  const saveTimerRefs = useRef<{ [key: number]: ReturnType<typeof setTimeout> }>({});

  // 親→子同期は「未保存の変更が無いときだけ」反映して上書きを防ぐ
  const prevMessagesRef = useRef<StepMessage[] | null>(null);
  useEffect(() => {
    if (Object.keys(hasUnsavedChanges).length === 0) {
      if (prevMessagesRef.current !== messages) {
        setEditingMessages(messages);
        prevMessagesRef.current = messages;
        // console.log('Synced from parent messages');
      }
    } else {
      // console.log('Skip parent sync due to local unsaved changes');
    }
  }, [messages, hasUnsavedChanges]);

  useEffect(() => {
    fetchScenarios();
    fetchFlexMessages();
    return () => {
      // アンマウント時に保留タイマーをクリア
      Object.values(saveTimerRefs.current).forEach(t => clearTimeout(t));
    };
  }, []);

  // プレビューは保存済みデータのみから生成（親 messages を参照）
  useEffect(() => {
    if (onPreviewChange && messages.length > 0) {
      const restoreMessage = messages.find(msg => msg.message_type === 'restore_access');
      if (restoreMessage) {
        onPreviewChange({
          type: 'restore_access',
          config: restoreMessage.restore_config
        });
      }
    }
  }, [messages, onPreviewChange]);

  const fetchScenarios = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('step_scenarios')
        .select('*')
        .eq('user_id', user.id)
        .order('name');
      setScenarios(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchFlexMessages = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('flex_messages')
        .select('*')
        .eq('user_id', user.id)
        .order('name');
      setFlexMessages(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const addMessage = async () => {
    try {
      const newMessage = await createMessage(stepId);
      if (newMessage) {
        // createMessage が外側の状態を更新する前提（親→子同期で反映される）
        toast.success('メッセージを追加しました');
      }
    } catch (error) {
      console.error('Error adding message:', error);
      toast.error('メッセージの追加に失敗しました');
    }
  };

  // ローカル編集のみ（保存は別途）
  const updateLocalMessage = (index: number, updates: Partial<StepMessage>) => {
    setEditingMessages(prev => {
      const updated = prev.map((msg, i) => (i === index ? { ...msg, ...updates } : msg));
      // 編集中のメッセージを親に通知（プレビュー即時更新用）
      if (onEditingMessagesChange) onEditingMessagesChange(updated);
      return updated;
    });
    // 未保存状態としてマーク
    setHasUnsavedChanges(prev => ({ ...prev, [index]: true }));

    // プレビューも即時更新（編集中データ）
    if (onPreviewChange) {
      const after = { ...editingMessages[index], ...updates };
      if (after.message_type === 'restore_access') {
        onPreviewChange({
          type: 'restore_access',
          config: after.restore_config
        });
      }
    }
  };

  // override を渡せば、その内容で保存（直前の編集を確実に保存）
  const saveMessage = async (index: number, override?: StepMessage) => {
    const message = override ?? editingMessages[index];
    if (!message) return;

    setSavingStates(prev => ({ ...prev, [index]: true }));
    try {
      // 内容チェック
      if (!message.content && !message.media_url && !message.flex_message_id && !message.restore_config) {
        toast.error('メッセージの内容を入力してください');
        return;
      }

      if (message.id) {
        // 既存更新
        const payload: any = {
          message_type: message.message_type,
          content: message.content || '',
          media_url: message.media_url ?? null,
          flex_message_id: message.flex_message_id ?? null,
          message_order: message.message_order,
          restore_config: message.restore_config ?? null,
        };

        const { error, data } = await supabase
          .from('step_messages')
          .update(payload)
          .eq('id', message.id)
          .select()
          .single();

        if (error) throw error;

        const savedMessage: StepMessage = {
          id: data.id,
          message_type: data.message_type,
          content: data.content,
          media_url: data.media_url,
          flex_message_id: data.flex_message_id,
          message_order: data.message_order,
          restore_config: data.restore_config
        };

        // 親へ反映
        const updatedParent = [...messages];
        updatedParent[index] = savedMessage;
        onMessagesChange(updatedParent);

        // ローカルも同期
        setEditingMessages(prev => prev.map((m, i) => (i === index ? savedMessage : m)));

      } else {
        // 新規作成
        const payload: any = {
          step_id: stepId,
          message_type: message.message_type,
          content: message.content || '',
          media_url: message.media_url ?? null,
          flex_message_id: message.flex_message_id ?? null,
          message_order: message.message_order,
          restore_config: message.restore_config ?? null,
        };

        const { error, data } = await supabase
          .from('step_messages')
          .insert(payload)
          .select()
          .single();

        if (error) throw error;

        const savedMessage: StepMessage = {
          id: data.id,
          message_type: data.message_type,
          content: data.content,
          media_url: data.media_url,
          flex_message_id: data.flex_message_id,
          message_order: data.message_order,
          restore_config: data.restore_config
        };

        // 親・ローカルへ反映
        setEditingMessages(prev => prev.map((m, i) => (i === index ? savedMessage : m)));
        const updatedParent = [...messages];
        updatedParent[index] = savedMessage;
        onMessagesChange(updatedParent);
      }

      // 未保存フラグをクリア
      setHasUnsavedChanges(prev => {
        const cp = { ...prev };
        delete cp[index];
        return cp;
      });
      toast.success(`メッセージ ${index + 1} を保存しました`);

    } catch (error) {
      console.error('Error saving message:', error);
      toast.error('メッセージの保存に失敗しました');
    } finally {
      setSavingStates(prev => {
        const cp = { ...prev };
        delete cp[index];
        return cp;
      });
    }
  };

  // デバウンス付きでローカル編集＋自動保存
  const updateLocalMessageWithDebounce = (index: number, updates: Partial<StepMessage>) => {
    // 先に「保存対象（最新版）」を作っておく
    const next: StepMessage = { ...editingMessages[index], ...updates };

    // ローカル状態を即座に更新
    updateLocalMessage(index, updates);
    
    // 既存タイマーをクリア
    if (saveTimerRefs.current[index]) {
      clearTimeout(saveTimerRefs.current[index]);
    }
    
    // 新しいタイマー（1秒後に最新内容で保存）
    saveTimerRefs.current[index] = setTimeout(() => {
      saveMessage(index, next);
      delete saveTimerRefs.current[index];
    }, 1000);
  };

  const saveAllMessages = async () => {
    const unsavedIndexes = Object.keys(hasUnsavedChanges).map(Number).sort((a,b)=>a-b);
    if (unsavedIndexes.length === 0) {
      toast.info('保存する変更がありません');
      return;
    }
    for (const idx of unsavedIndexes) {
      await saveMessage(idx);
    }
  };

  const removeMessage = async (index: number) => {
    const message = editingMessages[index];
    
    if (!message.id) {
      // 新規（未保存）をローカルから消す
      const filtered = editingMessages
        .filter((_, i) => i !== index)
        .map((msg, i) => ({ ...msg, message_order: i }));
      setEditingMessages(filtered);

      // 親も同期
      const parentFiltered = messages
        .filter((_, i) => i !== index)
        .map((msg, i) => ({ ...msg, message_order: i }));
      onMessagesChange(parentFiltered);

      // 未保存フラグのインデックスを詰める
      setHasUnsavedChanges(prev => {
        const updated = { ...prev };
        delete updated[index];
        const newUnsaved: { [key: number]: boolean } = {};
        Object.keys(updated).forEach(k => {
          const n = Number(k);
          if (n > index) newUnsaved[n - 1] = true;
          else if (n < index) newUnsaved[n] = true;
        });
        return newUnsaved;
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('step_messages')
        .delete()
        .eq('id', message.id);
      if (error) throw error;

      const filtered = editingMessages
        .filter((_, i) => i !== index)
        .map((msg, i) => ({ ...msg, message_order: i }));
      setEditingMessages(filtered);

      const parentFiltered = messages
        .filter((_, i) => i !== index)
        .map((msg, i) => ({ ...msg, message_order: i }));
      onMessagesChange(parentFiltered);

      setHasUnsavedChanges(prev => {
        const updated = { ...prev };
        delete updated[index];
        const newUnsaved: { [key: number]: boolean } = {};
        Object.keys(updated).forEach(k => {
          const n = Number(k);
          if (n > index) newUnsaved[n - 1] = true;
          else if (n < index) newUnsaved[n] = true;
        });
        return newUnsaved;
      });

      toast.success('メッセージを削除しました');
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('メッセージの削除に失敗しました');
    }
  };

  const moveMessage = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= editingMessages.length) return;

    const reordered = [...editingMessages];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    const updated = reordered.map((msg, i) => ({ ...msg, message_order: i }));
    setEditingMessages(updated);

    // 親の状態は手動保存時に反映でもOK。ここでは未保存にマーク。
    setHasUnsavedChanges(prev => ({
      ...prev,
      [index]: true,
      [newIndex]: true
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">メッセージ設定</h3>
        {Object.keys(hasUnsavedChanges).length > 0 && (
          <Button onClick={saveAllMessages} size="sm" className="bg-blue-600 hover:bg-blue-700">
            <Save className="h-4 w-4 mr-1" />
            すべて保存 ({Object.keys(hasUnsavedChanges).length})
          </Button>
        )}
      </div>

      {editingMessages.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          メッセージが設定されていません。「メッセージ追加」ボタンで追加してください。
        </p>
      ) : (
        <div className="space-y-3">
          {editingMessages.map((message, index) => {
            const cardKey = `${message.id ?? `idx-${index}`}-${message.message_type}`;
            const isDirty = !!hasUnsavedChanges[index];

            return (
              <Card
                key={cardKey}
                className={isDirty ? "border-orange-200 bg-orange-50/30" : ""}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      メッセージ {index + 1}
                      {message.message_type === "restore_access" && (
                        <Badge className="bg-green-100 text-green-800 text-xs">
                          アクセス解除＆シナリオ再登録
                        </Badge>
                      )}
                      {isDirty && (
                        <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs">
                          未保存
                        </Badge>
                      )}
                    </CardTitle>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveMessage(index, 'up')}
                        disabled={index === 0}
                      >
                        ↑
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveMessage(index, 'down')}
                        disabled={index === editingMessages.length - 1}
                      >
                        ↓
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMessage(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label>メッセージタイプ</Label>
                    <Select
                      value={message.message_type}
                      onValueChange={(value: StepMessage["message_type"]) => {
                        const updates: Partial<StepMessage> = { 
                          message_type: value,
                          // タイプ変更時に関連設定を整える
                          media_url: value === 'media' ? message.media_url ?? null : null,
                          flex_message_id: value === 'flex' ? message.flex_message_id ?? null : null,
                          restore_config: value === 'restore_access' 
                            ? (message.restore_config || { type: 'button' }) 
                            : null
                        };

                        const next: StepMessage = { ...editingMessages[index], ...updates };
                        updateLocalMessage(index, updates);

                        // 次フレームで保存（UI切替→保存の順）
                        requestAnimationFrame(() => {
                          saveMessage(index, next).catch(console.error);
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">テキストメッセージ</SelectItem>
                        <SelectItem value="media">メディアメッセージ</SelectItem>
                        <SelectItem value="flex">Flexメッセージ</SelectItem>
                        <SelectItem value="restore_access">
                          アクセス解除＆シナリオ再登録
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {message.message_type === "restore_access" && (
                    <div className="space-y-4 p-4 bg-green-50 rounded-lg border border-green-200">
                      <div className="space-y-2">
                        <Label>復活ボタンタイプ</Label>
                        <Select
                          value={message.restore_config?.type || "button"}
                          onValueChange={(value: "button" | "image") => {
                            const updates: Partial<StepMessage> = {
                              restore_config: { ...message.restore_config, type: value }
                            };
                            const next = { ...editingMessages[index], ...updates } as StepMessage;
                            updateLocalMessage(index, updates);
                            setTimeout(() => saveMessage(index, next), 150);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="button">OKボタン</SelectItem>
                            <SelectItem value="image">画像ボタン</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {message.restore_config?.type === "button" && (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>メッセージテキスト</Label>
                            <Input
                              value={message.restore_config?.title || ""}
                              onChange={(e) => 
                                updateLocalMessage(index, {
                                  restore_config: { 
                                    ...message.restore_config, 
                                    title: e.target.value 
                                  }
                                })
                              }
                              onBlur={() => saveMessage(index)}
                              placeholder="確認メッセージのテキスト"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>ボタンラベル</Label>
                            <Input
                              value={message.restore_config?.button_text || ""}
                              onChange={(e) => 
                                updateLocalMessage(index, {
                                  restore_config: { 
                                    ...message.restore_config, 
                                    button_text: e.target.value 
                                  }
                                })
                              }
                              onBlur={() => saveMessage(index)}
                              placeholder="ボタンに表示するテキスト"
                            />
                          </div>
                        </div>
                      )}

                      {message.restore_config?.type === "image" && (
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <Label>画像選択</Label>
                            <MediaLibrarySelector
                              trigger={
                                <Button variant="outline" className="w-full">
                                  <Image className="h-4 w-4 mr-2" />
                                  メディアライブラリから選択
                                </Button>
                              }
                              onSelect={(url) => {
                                const updates: Partial<StepMessage> = {
                                  restore_config: { 
                                    ...message.restore_config, 
                                    image_url: url 
                                  }
                                };
                                const next = { ...editingMessages[index], ...updates } as StepMessage;
                                updateLocalMessage(index, updates);
                                setTimeout(() => saveMessage(index, next), 150);
                              }}
                              selectedUrl={message.restore_config?.image_url}
                            />
                          </div>
                          {message.restore_config?.image_url && (
                            <div className="border rounded p-2">
                              <img 
                                src={message.restore_config.image_url} 
                                alt="Selected restoration" 
                                className="max-w-full h-32 object-contain mx-auto"
                              />
                            </div>
                          )}
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label>再登録先シナリオ</Label>
                        <Select
                          value={message.restore_config?.target_scenario_id || ""}
                          onValueChange={(value) => {
                            const updates: Partial<StepMessage> = {
                              restore_config: { 
                                ...message.restore_config, 
                                target_scenario_id: value 
                              }
                            };
                            const next = { ...editingMessages[index], ...updates } as StepMessage;
                            updateLocalMessage(index, updates);
                            setTimeout(() => saveMessage(index, next), 150);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="シナリオを選択" />
                          </SelectTrigger>
                          <SelectContent>
                            {scenarios.map((scenario) => (
                              <SelectItem key={scenario.id} value={scenario.id}>
                                {scenario.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {message.message_type === "text" && (
                    <div className="space-y-2">
                      <Label>メッセージ内容</Label>
                      <Textarea
                        value={message.content}
                        onChange={(e) => updateLocalMessageWithDebounce(index, { content: e.target.value })}
                        placeholder="テキストメッセージを入力..."
                        rows={4}
                      />
                    </div>
                  )}

                  {message.message_type === "media" && (
                    <div className="space-y-2">
                      <Label>メディア選択</Label>
                      <MediaLibrarySelector
                        trigger={
                          <Button variant="outline" className="w-full">
                            <Image className="h-4 w-4 mr-2" />
                            メディアライブラリから選択
                          </Button>
                        }
                        onSelect={(url) => {
                          const updates: Partial<StepMessage> = { media_url: url };
                          const next = { ...editingMessages[index], ...updates } as StepMessage;
                          updateLocalMessage(index, updates);
                          setTimeout(() => saveMessage(index, next), 150);
                        }}
                      />
                      {message.media_url && (
                        <div className="text-sm text-muted-foreground">
                          選択中: {message.media_url}
                        </div>
                      )}
                    </div>
                  )}

                  {message.message_type === "flex" && (
                    <div className="space-y-2">
                      <Label>Flexメッセージ</Label>
                      <FlexMessageSelector
                        selectedFlexMessageId={message.flex_message_id || ""}
                        onSelect={(value) => {
                          const updates: Partial<StepMessage> = { flex_message_id: value };
                          const next = { ...editingMessages[index], ...updates } as StepMessage;
                          updateLocalMessage(index, updates);
                          setTimeout(() => saveMessage(index, next), 150);
                        }}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      
      <div className="flex justify-center">
        <Button onClick={addMessage} className="w-full max-w-md">
          <Plus className="h-4 w-4 mr-2" />
          メッセージ追加
        </Button>
      </div>
    </div>
  );
}

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Image, Save, Loader2 } from "lucide-react";
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
}

export default function StepMessageEditor({ 
  stepId, 
  messages, 
  onMessagesChange,
  onPreviewChange,
  onEditingMessagesChange
}: StepMessageEditorProps) {
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [flexMessages, setFlexMessages] = useState<any[]>([]);
  
  // ローカル編集状態（保存されるまでは一時的な状態）
  const [editingMessages, setEditingMessages] = useState<StepMessage[]>(messages);
  
  // 各メッセージの保存状態を管理
  const [savingStates, setSavingStates] = useState<{ [key: number]: boolean }>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<{ [key: number]: boolean }>({});

  useEffect(() => {
    fetchScenarios();
    fetchFlexMessages();
  }, []);

  // 親のmessagesが変更された時のみローカル状態を同期
  useEffect(() => {
    setEditingMessages(messages);
    setHasUnsavedChanges({});
  }, [messages]);

  // プレビューは保存済みデータのみから生成
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
      // 直接データベースに新しいメッセージを作成
      const newMessage = {
        step_id: stepId,
        message_type: "text" as const,
        content: "",
        message_order: editingMessages.length,
      };

      const { data, error } = await supabase
        .from('step_messages')
        .insert(newMessage)
        .select()
        .single();

      if (error) throw error;

      const createdMessage: StepMessage = {
        id: data.id,
        message_type: data.message_type as any,
        content: data.content,
        media_url: data.media_url,
        flex_message_id: data.flex_message_id,
        message_order: data.message_order,
        restore_config: data.restore_config as any
      };

      // ローカル状態と親状態を同期
      setEditingMessages(prev => [...prev, createdMessage]);
      onMessagesChange([...messages, createdMessage]);
      
      toast.success('メッセージを追加しました');
    } catch (error) {
      console.error('Error adding message:', error);
      toast.error('メッセージの追加に失敗しました');
    }
  };

  // ローカル編集のみ（保存は別途）
  const updateLocalMessage = (index: number, updates: Partial<StepMessage>) => {
    const updated = editingMessages.map((msg, i) => 
      i === index ? { ...msg, ...updates } : msg
    );
    setEditingMessages(updated);
    
    // 未保存状態としてマーク
    setHasUnsavedChanges(prev => ({ ...prev, [index]: true }));

    // 編集中のメッセージを親に通知（プレビューの即座更新用）
    if (onEditingMessagesChange) {
      onEditingMessagesChange(updated);
    }

    // プレビューを即座に更新（編集中の状態でプレビューを更新）
    if (onPreviewChange) {
      const updatedMessage = updated[index];
      if (updatedMessage.message_type === 'restore_access') {
        onPreviewChange({
          type: 'restore_access',
          config: updatedMessage.restore_config
        });
      }
    }
  };

  // 個別メッセージの保存機能
  const saveMessage = async (index: number) => {
    const message = editingMessages[index];
    
    // 保存中状態を設定
    setSavingStates(prev => ({ ...prev, [index]: true }));
    
    try {
      // メッセージデータの検証と準備
      if (!message.content && !message.media_url && !message.flex_message_id && !message.restore_config) {
        toast.error('メッセージの内容を入力してください');
        return;
      }

      if (message.id) {
        // 既存メッセージの更新
        const payload: any = {
          message_type: message.message_type,
          content: message.content || '',
          media_url: message.media_url,
          flex_message_id: message.flex_message_id,
          message_order: message.message_order,
          restore_config: message.restore_config,
        };

        const { error, data } = await supabase
          .from('step_messages')
          .update(payload)
          .eq('id', message.id)
          .select()
          .single();

        if (error) {
          console.error('Error updating message:', error);
          throw error;
        }

        // 親の状態を更新（保存済みデータを反映）
        const updatedMessages = messages.map((msg, i) => 
          i === index ? {
            id: data.id,
            message_type: data.message_type as any,
            content: data.content,
            media_url: data.media_url,
            flex_message_id: data.flex_message_id,
            message_order: data.message_order,
            restore_config: data.restore_config as any
          } : msg
        );
        onMessagesChange(updatedMessages);
        
      } else {
        // 新規メッセージの作成
        const payload: any = {
          step_id: stepId,
          message_type: message.message_type,
          content: message.content || '',
          media_url: message.media_url,
          flex_message_id: message.flex_message_id,
          message_order: message.message_order,
          restore_config: message.restore_config,
        };

        const { error, data } = await supabase
          .from('step_messages')
          .insert(payload)
          .select()
          .single();

        if (error) {
          console.error('Error creating message:', error);
          throw error;
        }

        // 新規作成されたメッセージをローカル状態に反映
        const updatedEditingMessages = editingMessages.map((msg, i) => 
          i === index ? {
            id: data.id,
            message_type: data.message_type as any,
            content: data.content,
            media_url: data.media_url,
            flex_message_id: data.flex_message_id,
            message_order: data.message_order,
            restore_config: data.restore_config as any
          } : msg
        );
        setEditingMessages(updatedEditingMessages);

        // 親の状態にも追加
        const updatedMessages = [...messages];
        updatedMessages[index] = {
          id: data.id,
          message_type: data.message_type as any,
          content: data.content,
          media_url: data.media_url,
          flex_message_id: data.flex_message_id,
          message_order: data.message_order,
          restore_config: data.restore_config as any
        };
        onMessagesChange(updatedMessages);
      }

      // 保存成功：未保存フラグをクリア
      setHasUnsavedChanges(prev => {
        const updated = { ...prev };
        delete updated[index];
        return updated;
      });
      
      toast.success(`メッセージ ${index + 1} を保存しました`);
      
    } catch (error) {
      console.error('Error saving message:', error);
      toast.error('メッセージの保存に失敗しました');
    } finally {
      // 保存中状態をクリア
      setSavingStates(prev => {
        const updated = { ...prev };
        delete updated[index];
        return updated;
      });
    }
  };

  // 全メッセージの保存機能
  const saveAllMessages = async () => {
    const unsavedIndexes = Object.keys(hasUnsavedChanges).map(Number);
    
    if (unsavedIndexes.length === 0) {
      toast.info('保存する変更がありません');
      return;
    }

    // 各メッセージを順番に保存
    for (const index of unsavedIndexes) {
      await saveMessage(index);
    }
  };

  const removeMessage = async (index: number) => {
    const message = editingMessages[index];
    
    if (!message.id) {
      // 新規メッセージ（DBに未保存）の削除
      const filtered = editingMessages.filter((_, i) => i !== index)
        .map((msg, i) => ({ ...msg, message_order: i }));
      setEditingMessages(filtered);
      
      // 未保存状態もクリア
      setHasUnsavedChanges(prev => {
        const updated = { ...prev };
        delete updated[index];
        // インデックスをシフト
        const newUnsaved: { [key: number]: boolean } = {};
        Object.keys(updated).forEach(key => {
          const keyNum = Number(key);
          if (keyNum > index) {
            newUnsaved[keyNum - 1] = true;
          } else if (keyNum < index) {
            newUnsaved[keyNum] = true;
          }
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

      // ローカル状態から削除
      const filtered = editingMessages.filter((_, i) => i !== index)
        .map((msg, i) => ({ ...msg, message_order: i }));
      setEditingMessages(filtered);
      
      // 親の状態からも削除
      const parentFiltered = messages.filter((_, i) => i !== index)
        .map((msg, i) => ({ ...msg, message_order: i }));
      onMessagesChange(parentFiltered);
      
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

    // 両方のメッセージを未保存状態にマーク
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
          {editingMessages.map((message, index) => (
            <Card key={index} className={hasUnsavedChanges[index] ? "border-orange-200 bg-orange-50/30" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    メッセージ {index + 1}
                    {message.message_type === "restore_access" && (
                      <Badge className="bg-green-100 text-green-800 text-xs">
                        アクセス解除＆シナリオ再登録
                      </Badge>
                    )}
                    {hasUnsavedChanges[index] && (
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
                    onValueChange={(value: any) => {
                      const updates: Partial<StepMessage> = { 
                        message_type: value,
                        // メッセージタイプ変更時に関連設定をリセット
                        media_url: value === 'media' ? message.media_url : null,
                        flex_message_id: value === 'flex' ? message.flex_message_id : null,
                        restore_config: value === 'restore_access' ? (message.restore_config || { type: 'button' }) : null
                      };
                      
                      // ローカル状態を即座に更新
                      updateLocalMessage(index, updates);
                      
                      // 少し遅延してから保存（状態更新の完了を待つ）
                      setTimeout(async () => {
                        await saveMessage(index);
                      }, 150);
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
                        <div className="flex items-center gap-2 bg-green-50 px-2 py-1 rounded-md">
                          <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
                          <span className="text-green-800 font-medium">アクセス解除＆シナリオ再登録</span>
                        </div>
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
                          updateLocalMessage(index, {
                            restore_config: { 
                              ...message.restore_config, 
                              type: value 
                            }
                          });
                          // 少し遅延してから保存
                          setTimeout(async () => {
                            await saveMessage(index);
                          }, 150);
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
                              updateLocalMessage(index, {
                                restore_config: { 
                                  ...message.restore_config, 
                                  image_url: url 
                                }
                              });
                              setTimeout(async () => {
                                await saveMessage(index);
                              }, 150);
                            }}
                            selectedUrl={message.restore_config?.image_url}
                          />
                        </div>
                        {message.restore_config?.image_url && (
                          <div className="border rounded p-2">
                            <img 
                              src={message.restore_config.image_url} 
                              alt="Selected restoration image" 
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
                          updateLocalMessage(index, {
                            restore_config: { 
                              ...message.restore_config, 
                              target_scenario_id: value 
                            }
                          });
                          setTimeout(async () => {
                            await saveMessage(index);
                          }, 150);
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
                      onChange={(e) => updateLocalMessage(index, { content: e.target.value })}
                      onBlur={() => saveMessage(index)}
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
                        updateLocalMessage(index, { media_url: url });
                        setTimeout(async () => {
                          await saveMessage(index);
                        }, 150);
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
                        updateLocalMessage(index, { flex_message_id: value });
                        setTimeout(async () => {
                          await saveMessage(index);
                        }, 150);
                      }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
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
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/RichTextEditor";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Plus, X, Trash2 } from "lucide-react";

interface SuccessMessage {
  id: string;
  name: string;
  content: string;
  isRich: boolean;
}

interface SuccessMessageManagerProps {
  successMessage: string;
  setSuccessMessage: (message: string) => void;
  formId?: string; // To track per-form selection
}

export function SuccessMessageManager({ successMessage, setSuccessMessage, formId = 'default' }: SuccessMessageManagerProps) {
  const [isRichEditor, setIsRichEditor] = useState(false);
  const [showManager, setShowManager] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [savedMessages, setSavedMessages] = useState<SuccessMessage[]>([]);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<SuccessMessage | null>(null);
  const [newMessageName, setNewMessageName] = useState("");
  const [newMessageContent, setNewMessageContent] = useState("");
  const [plainTextMessage, setPlainTextMessage] = useState("");

  // Load saved messages from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('form-success-messages');
    const savedSelections = localStorage.getItem('form-success-selections');
    const savedRichSettings = localStorage.getItem('form-rich-editor-settings');
    const savedPlainText = localStorage.getItem('form-plain-text-messages');
    
    if (saved) {
      try {
        setSavedMessages(JSON.parse(saved));
      } catch (error) {
        console.error('Failed to load saved messages:', error);
      }
    }
    
    // Load rich editor setting for this specific form
    if (savedRichSettings) {
      try {
        const richSettings = JSON.parse(savedRichSettings);
        const currentRichSetting = richSettings[formId];
        if (currentRichSetting !== undefined) {
          setIsRichEditor(currentRichSetting);
        }
      } catch (error) {
        console.error('Failed to load rich settings:', error);
      }
    }
    
    // Load plain text message for this form
    if (savedPlainText) {
      try {
        const plainMessages = JSON.parse(savedPlainText);
        const currentPlainMessage = plainMessages[formId];
        if (currentPlainMessage) {
          setPlainTextMessage(currentPlainMessage);
        }
      } catch (error) {
        console.error('Failed to load plain messages:', error);
      }
    }
    
    if (savedSelections) {
      try {
        const selections = JSON.parse(savedSelections);
        const currentSelection = selections[formId];
        if (currentSelection) {
          setSelectedMessageId(currentSelection);
          // Set the success message content for this form
          const savedMsg = JSON.parse(localStorage.getItem('form-success-messages') || '[]');
          const selectedMsg = savedMsg.find((msg: SuccessMessage) => msg.id === currentSelection);
          if (selectedMsg) {
            setSuccessMessage(selectedMsg.content);
          }
        } else {
          // If no rich message selected, load plain text
          const plainMessages = JSON.parse(localStorage.getItem('form-plain-text-messages') || '{}');
          const currentPlainMessage = plainMessages[formId];
          if (currentPlainMessage) {
            setSuccessMessage(currentPlainMessage);
          }
        }
      } catch (error) {
        console.error('Failed to load saved selections:', error);
      }
    }
  }, [formId, setSuccessMessage]);

  // Save messages to localStorage
  const saveMessages = (messages: SuccessMessage[]) => {
    localStorage.setItem('form-success-messages', JSON.stringify(messages));
    setSavedMessages(messages);
  };

  // Save rich editor setting per form
  const saveRichEditorSetting = (isRich: boolean) => {
    const saved = localStorage.getItem('form-rich-editor-settings');
    let settings = {};
    if (saved) {
      try {
        settings = JSON.parse(saved);
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    }
    
    settings[formId] = isRich;
    localStorage.setItem('form-rich-editor-settings', JSON.stringify(settings));
  };

  // Save plain text message per form
  const savePlainTextMessage = (message: string) => {
    const saved = localStorage.getItem('form-plain-text-messages');
    let messages = {};
    if (saved) {
      try {
        messages = JSON.parse(saved);
      } catch (error) {
        console.error('Failed to load plain messages:', error);
      }
    }
    
    messages[formId] = message;
    localStorage.setItem('form-plain-text-messages', JSON.stringify(messages));
    setPlainTextMessage(message);
  };

  // Save selection per form
  const saveSelection = (messageId: string | null) => {
    const saved = localStorage.getItem('form-success-selections');
    let selections = {};
    if (saved) {
      try {
        selections = JSON.parse(saved);
      } catch (error) {
        console.error('Failed to load selections:', error);
      }
    }
    
    if (messageId) {
      selections[formId] = messageId;
    } else {
      delete selections[formId];
    }
    
    localStorage.setItem('form-success-selections', JSON.stringify(selections));
    setSelectedMessageId(messageId);
  };

  // Strip HTML tags from rich content
  const stripHTMLTags = (html: string): string => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    return tempDiv.textContent || tempDiv.innerText || '';
  };

  const handleCreateNew = () => {
    setEditingMessage(null);
    setNewMessageName("");
    setNewMessageContent("");
    setShowEditor(true);
  };

  const handleEditMessage = (message: SuccessMessage) => {
    setEditingMessage(message);
    setNewMessageName(message.name);
    setNewMessageContent(message.content);
    setShowEditor(true);
  };

  const handleSaveMessage = () => {
    if (!newMessageName.trim()) return;
    
    const messageData: SuccessMessage = {
      id: editingMessage?.id || Date.now().toString(),
      name: newMessageName,
      content: newMessageContent,
      isRich: true
    };

    if (editingMessage) {
      // Update existing message
      const updated = savedMessages.map(msg => 
        msg.id === editingMessage.id ? messageData : msg
      );
      saveMessages(updated);
    } else {
      // Create new message
      saveMessages([...savedMessages, messageData]);
    }
    
    setShowEditor(false);
  };

  const handleToggleMessage = (message: SuccessMessage, isSelected: boolean) => {
    if (isSelected) {
      setSuccessMessage(message.content);
      saveSelection(message.id);
    } else {
      setSuccessMessage("");
      saveSelection(null);
    }
  };

  // Get the currently selected message for this form
  const currentSelectedMessage = savedMessages.find(msg => msg.id === selectedMessageId);

  const handleDeleteMessage = (id: string) => {
    const updated = savedMessages.filter(msg => msg.id !== id);
    saveMessages(updated);
    
    // If deleting the currently selected message, clear selection
    if (selectedMessageId === id) {
      setSuccessMessage("");
      saveSelection(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm">送信成功メッセージ</label>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">リッチエディタ</span>
          <Switch 
            checked={isRichEditor} 
            onCheckedChange={(checked) => {
              setIsRichEditor(checked);
              saveRichEditorSetting(checked);
              if (checked) {
                // When switching to rich editor, load selected message if available
                if (selectedMessageId) {
                  const savedMsg = savedMessages.find(msg => msg.id === selectedMessageId);
                  if (savedMsg) {
                    setSuccessMessage(savedMsg.content);
                  }
                } else {
                  setShowManager(true);
                }
              } else {
                // When switching to plain text, convert HTML to plain text
                if (successMessage) {
                  const plainText = stripHTMLTags(successMessage);
                  setSuccessMessage(plainText);
                  savePlainTextMessage(plainText);
                } else {
                  setSuccessMessage(plainTextMessage);
                }
                // Clear rich message selection
                saveSelection(null);
              }
            }} 
          />
        </div>
      </div>

      {isRichEditor ? (
        <div className="space-y-2">
          {currentSelectedMessage && (
            <div className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded">
              設定中: {currentSelectedMessage.name}
            </div>
          )}
          <Button 
            variant="outline" 
            onClick={() => setShowManager(true)}
            className="w-full"
          >
            フォーム成功画面の新規作成/設定
          </Button>
        </div>
      ) : (
        <Textarea 
          value={successMessage} 
          onChange={(e) => {
            setSuccessMessage(e.target.value);
            savePlainTextMessage(e.target.value);
          }}
          rows={3}
          placeholder="送信完了メッセージを入力してください"
        />
      )}

      {/* Success Message Manager Dialog */}
      <Dialog open={showManager} onOpenChange={setShowManager}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>成功メッセージ管理</span>
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
            {savedMessages.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-xs">
                保存されたメッセージがありません
              </div>
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
                  {savedMessages.map((message) => (
                    <TableRow key={message.id} className="h-8">
                      <TableCell className="p-2">
                        <Switch 
                          checked={selectedMessageId === message.id}
                          onCheckedChange={(checked) => handleToggleMessage(message, checked)}
                          className="scale-75"
                        />
                      </TableCell>
                      <TableCell className="font-medium text-xs p-2">{message.name}</TableCell>
                      <TableCell className="p-2">
                        <div className="flex gap-1">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handleEditMessage(message)}
                            className="h-6 px-2 text-xs"
                          >
                            編集
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive" 
                            onClick={() => handleDeleteMessage(message.id)}
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
            
            <div className="flex justify-end mt-4">
              <Button onClick={() => setShowManager(false)} className="h-8 px-4 text-xs">
                保存
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Message Editor Dialog */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingMessage ? 'メッセージを編集' : '新しいメッセージを作成'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">メッセージ名</label>
              <Input 
                value={newMessageName}
                onChange={(e) => setNewMessageName(e.target.value)}
                placeholder="メッセージの名前を入力"
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-sm font-medium">メッセージ内容</label>
              <RichTextEditor 
                value={newMessageContent}
                onChange={setNewMessageContent}
                className="min-h-[300px]"
              />
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowEditor(false)}>
                キャンセル
              </Button>
              <Button onClick={handleSaveMessage} disabled={!newMessageName.trim()}>
                {editingMessage ? '更新' : '新規保存'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
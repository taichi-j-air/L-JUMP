import { useState, useEffect, useMemo } from "react";
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
  content: string; // rich HTML
  isRich: boolean;
}

interface SuccessMessageManagerProps {
  /** 親のフォーム設定に反映するための値 */
  successMessage: string;
  setSuccessMessage: (message: string) => void;

  /** 必須: フォームごとのユニークID */
  formId: string;
}

export function SuccessMessageManager({
  successMessage,
  setSuccessMessage,
  formId,
}: SuccessMessageManagerProps) {
  if (!formId) {
    console.error("SuccessMessageManager: formId is required");
    return null;
  }

  // ─────────────────────────────────────────────
  // helpers: namespaced localStorage
  // ─────────────────────────────────────────────
  const nsKey = (suffix: string) => `form:${formId}:${suffix}`;

  const readJSON = <T,>(key: string, fallback: T): T => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  };
  const saveJSON = (key: string, value: any) => {
    localStorage.setItem(key, JSON.stringify(value));
  };

  const [isRichEditor, setIsRichEditor] = useState<boolean>(false);
  const [showManager, setShowManager] = useState(false);
  const [showEditor, setShowEditor] = useState(false);

  // 保存済みリッチメッセージ（これは全フォームで共有でOK）
  const [savedMessages, setSavedMessages] = useState<SuccessMessage[]>([]);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);

  // プレーンテキストはフォームごとに保持
  const [plainTextMessage, setPlainTextMessage] = useState<string>("送信ありがとうございます");

  // エディタ用一時状態
  const [editingMessage, setEditingMessage] = useState<SuccessMessage | null>(null);
  const [newMessageName, setNewMessageName] = useState("");
  const [newMessageContent, setNewMessageContent] = useState("");

  // HTML除去（プレーンに落とす時の保険）
  const stripHTMLTags = (html: string): string => {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  };

  // ─────────────────────────────────────────────
  // 初期ロード & 旧キーからの簡易マイグレーション
  // ─────────────────────────────────────────────
  useEffect(() => {
    // ① グローバルに保存しているリッチメッセージ群
    const all = readJSON<SuccessMessage[]>("form-success-messages", []);
    setSavedMessages(all);

    // ② フォーム別キーがなければ旧方式から移行
    // リッチON/OFF
    if (localStorage.getItem(nsKey("rich-enabled")) === null) {
      const old = readJSON<Record<string, boolean>>("form-rich-editor-settings", {});
      const v = !!old[formId];
      saveJSON(nsKey("rich-enabled"), v);
    }
    // 選択中リッチID
    if (localStorage.getItem(nsKey("selected-rich-id")) === null) {
      const oldSel = readJSON<Record<string, string>>("form-success-selections", {});
      const v = oldSel[formId] ?? null;
      if (v) localStorage.setItem(nsKey("selected-rich-id"), v);
    }
    // プレーンテキスト
    if (localStorage.getItem(nsKey("plain")) === null) {
      const oldPlain = readJSON<Record<string, string>>("form-plain-text-messages", {});
      const v = oldPlain[formId] ?? "送信ありがとうございます";
      localStorage.setItem(nsKey("plain"), v);
    }

    // ③ フォーム別キーを読み込み
    const richEnabled = readJSON<boolean>(nsKey("rich-enabled"), false);
    const selId = localStorage.getItem(nsKey("selected-rich-id"));
    const plain = localStorage.getItem(nsKey("plain")) || "送信ありがとうございます";

    setIsRichEditor(richEnabled);
    setSelectedMessageId(selId || null);
    setPlainTextMessage(plain);

    // ④ 親の successMessage をフォームの状態に合わせて初期化
    if (richEnabled && selId) {
      const msg = all.find((m) => m.id === selId);
      setSuccessMessage(msg?.content || plain);
    } else {
      setSuccessMessage(plain);
    }
  }, [formId, setSuccessMessage]);

  // ─────────────────────────────────────────────
  // 保存系
  // ─────────────────────────────────────────────
  const saveMessages = (messages: SuccessMessage[]) => {
    saveJSON("form-success-messages", messages);
    setSavedMessages(messages);
  };

  const saveRichEditorSetting = (enabled: boolean) => {
    saveJSON(nsKey("rich-enabled"), enabled);
  };

  const savePlainTextForForm = (message: string) => {
    localStorage.setItem(nsKey("plain"), message);
    setPlainTextMessage(message);
  };

  const saveSelectedRichId = (id: string | null) => {
    if (id) {
      localStorage.setItem(nsKey("selected-rich-id"), id);
      setSelectedMessageId(id);
    } else {
      localStorage.removeItem(nsKey("selected-rich-id"));
      setSelectedMessageId(null);
    }
  };

  // ─────────────────────────────────────────────
  // UI操作ハンドラ
  // ─────────────────────────────────────────────
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
    const data: SuccessMessage = {
      id: editingMessage?.id || Date.now().toString(),
      name: newMessageName,
      content: newMessageContent,
      isRich: true,
    };
    if (editingMessage) {
      const updated = savedMessages.map((m) => (m.id === editingMessage.id ? data : m));
      saveMessages(updated);
    } else {
      saveMessages([...savedMessages, data]);
    }
    setShowEditor(false);
  };

  const currentSelectedMessage = useMemo(
    () => savedMessages.find((m) => m.id === selectedMessageId) || null,
    [savedMessages, selectedMessageId]
  );

  const handleToggleUseRichMessage = (message: SuccessMessage, use: boolean) => {
    if (use) {
      saveSelectedRichId(message.id);
      setSuccessMessage(message.content);
    } else {
      saveSelectedRichId(null);
      // リッチを使わない＝プレーンに戻す
      setSuccessMessage(plainTextMessage);
    }
  };

  const handleDeleteMessage = (id: string) => {
    const updated = savedMessages.filter((m) => m.id !== id);
    saveMessages(updated);
    if (selectedMessageId === id) {
      saveSelectedRichId(null);
      setSuccessMessage(plainTextMessage);
    }
  };

  // リッチエディタのON/OFFスイッチ
  const handleSwitchRich = (checked: boolean) => {
    setIsRichEditor(checked);
    saveRichEditorSetting(checked);

    if (checked) {
      if (selectedMessageId) {
        const msg = savedMessages.find((m) => m.id === selectedMessageId);
        setSuccessMessage(msg?.content || plainTextMessage);
      } else {
        // リッチONにした直後に何も選ばれていなければ選択ダイアログを出す
        setShowManager(true);
      }
    } else {
      // リッチOFFに切り替えたら、HTMLが残らないよう必ずプレーンに戻す
      setSuccessMessage(plainTextMessage);
      saveSelectedRichId(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm">送信成功メッセージ</label>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">リッチエディタ</span>
          <Switch checked={isRichEditor} onCheckedChange={handleSwitchRich} />
        </div>
      </div>

      {isRichEditor ? (
        <div className="space-y-2">
          {currentSelectedMessage && (
            <div className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded">
              設定中: {currentSelectedMessage.name}
            </div>
          )}
          <Button variant="outline" onClick={() => setShowManager(true)} className="w-full">
            フォーム成功画面の新規作成/設定
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            オフにすると、リッチで設定した内容は表示されません（プレーンテキストに戻ります）
          </p>
        </div>
      ) : (
        // ★ リッチOFF時は Textarea の value に「常にプレーン用の state」を使う
        //   これで successMessage にリッチHTMLが残っていても表示されません。
        <Textarea
          value={plainTextMessage}
          onChange={(e) => {
            const val = e.target.value;
            setPlainTextMessage(val);
            savePlainTextForForm(val);
            // 親にも反映（プレーン運用中のみ）
            setSuccessMessage(val);
          }}
          rows={3}
          placeholder="送信完了メッセージを入力してください"
        />
      )}

      {/* 成功メッセージ管理ダイアログ */}
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
              <div className="text-center py-4 text-muted-foreground text-xs">保存されたメッセージがありません</div>
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
                          onCheckedChange={(checked) => handleToggleUseRichMessage(message, checked)}
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

      {/* リッチメッセージ編集ダイアログ */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingMessage ? "メッセージを編集" : "新しいメッセージを作成"}</DialogTitle>
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
              <RichTextEditor value={newMessageContent} onChange={setNewMessageContent} className="min-h-[300px]" />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowEditor(false)}>
                キャンセル
              </Button>
              <Button onClick={handleSaveMessage} disabled={!newMessageName.trim()}>
                {editingMessage ? "更新" : "新規保存"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

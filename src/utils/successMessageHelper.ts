// Success message helper utilities
// フォーム保存時にSuccessMessageManagerの設定を読み取り、適切なメッセージを取得する

interface SuccessMessage {
  id: string;
  name: string;
  content: string;
  isRich: boolean;
}

/**
 * フォームIDに基づいてlocalStorageから成功メッセージの設定を読み取り、
 * 実際に表示すべきメッセージを返す
 */
export const getSuccessMessageForSave = (formId: string): string => {
  if (!formId) return "送信ありがとうございました。";

  // SuccessMessageManagerと同じnamespaced localStorage key helpers
  const nsKey = (suffix: string) => `form:${formId}:${suffix}`;
  
  const readJSON = <T,>(key: string, fallback: T): T => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  };

  // リッチエディタのON/OFF状態を確認
  const richEnabled = readJSON<boolean>(nsKey("rich-enabled"), false);
  
  if (!richEnabled) {
    // リッチOFFの場合：プレーンテキストを取得
    const plainText = localStorage.getItem(nsKey("plain")) || "送信ありがとうございました。";
    return plainText;
  }
  
  // リッチONの場合：選択されているテンプレートを取得
  const selectedId = localStorage.getItem(nsKey("selected-rich-id"));
  if (!selectedId) {
    // テンプレート未選択の場合はプレーンにフォールバック
    const plainText = localStorage.getItem(nsKey("plain")) || "送信ありがとうございました。";
    return plainText;
  }
  
  // リッチテンプレートライブラリから該当のテンプレートを取得
  const templates = readJSON<SuccessMessage[]>("form-success-messages", []);
  const selectedTemplate = templates.find(t => t.id === selectedId);
  
  if (selectedTemplate) {
    return selectedTemplate.content;
  }
  
  // テンプレートが見つからない場合はプレーンにフォールバック
  const plainText = localStorage.getItem(nsKey("plain")) || "送信ありがとうございました。";
  return plainText;
};

/**
 * HTMLタグを除去してプレーンテキストに変換
 */
export const stripHTMLTags = (html: string): string => {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
};
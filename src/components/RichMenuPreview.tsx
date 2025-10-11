import { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Smartphone, Move } from "lucide-react";

interface TapArea {
  id: string;
  x_percent: number;
  y_percent: number;
  width_percent: number;
  height_percent: number;
  action_type: "uri" | "message" | "richmenuswitch";
  action_value: string;
}

interface RichMenuPreviewProps {
  backgroundImageUrl?: string;
  chatBarText: string;
  size: "full" | "half";
  tapAreas: TapArea[];
  selectedArea: string | null;
  onAreaSelect: (id: string | null) => void;
  onAreaUpdate: (id: string, updates: Partial<TapArea>) => void;
  editorRef: React.RefObject<HTMLDivElement>;
  onMouseDown: (e: React.MouseEvent, areaId: string) => void;
}

export const RichMenuPreview = ({
  backgroundImageUrl,
  chatBarText,
  size,
  tapAreas,
  selectedArea,
  onAreaSelect,
  onAreaUpdate,
  editorRef,
  onMouseDown,
}: RichMenuPreviewProps) => {
  const [resizingArea, setResizingArea] = useState<string | null>(null);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [draggingArea, setDraggingArea] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const selectedAreaData = tapAreas.find((area) => area.id === selectedArea);

  /** 範囲制限ユーティリティ */
  const clampArea = useCallback((area: Partial<TapArea> & Pick<TapArea, 'x_percent' | 'y_percent' | 'width_percent' | 'height_percent'>): Partial<TapArea> => {
    const x = Math.max(0, Math.min(area.x_percent, 100 - area.width_percent));
    const y = Math.max(0, Math.min(area.y_percent, 100 - area.height_percent));
    const width = Math.max(1, Math.min(area.width_percent, 100 - x));
    const height = Math.max(1, Math.min(area.height_percent, 100 - y));
    
    return { ...area, x_percent: x, y_percent: y, width_percent: width, height_percent: height };
  }, []);

  /** リサイズ開始 */
  const handleResizeMouseDown = useCallback((e: React.MouseEvent, handle: string, areaId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingArea(areaId);
    setResizeHandle(handle);
  }, []);

  /** ドラッグ移動開始 */
  const handleDragMoveStart = useCallback((e: React.MouseEvent, areaId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingArea(areaId);
  }, []);

  /** 手入力更新 */
  const handleManualUpdate = (field: string, value: number) => {
    if (!selectedArea) return;
    const clampedValue = Math.max(0, Math.min(100, value));
    onAreaUpdate(selectedArea, { [field]: clampedValue });
  };

  /** マウス移動によるリサイズ・ドラッグ処理 */
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!editorRef.current) return;

      const rect = editorRef.current.getBoundingClientRect();
      const deltaX = (e.movementX / rect.width) * 100;
      const deltaY = (e.movementY / rect.height) * 100;

      // リサイズ処理
      if (resizingArea && resizeHandle) {
        const area = tapAreas.find((a) => a.id === resizingArea);
        if (!area) return;

        let newArea = { ...area };

        switch (resizeHandle) {
          case "se": // 右下
            newArea.width_percent = area.width_percent + deltaX;
            newArea.height_percent = area.height_percent + deltaY;
            break;
          case "sw": // 左下
            newArea.x_percent = area.x_percent + deltaX;
            newArea.width_percent = area.width_percent - deltaX;
            newArea.height_percent = area.height_percent + deltaY;
            break;
          case "ne": // 右上
            newArea.y_percent = area.y_percent + deltaY;
            newArea.width_percent = area.width_percent + deltaX;
            newArea.height_percent = area.height_percent - deltaY;
            break;
          case "nw": // 左上
            newArea.x_percent = area.x_percent + deltaX;
            newArea.y_percent = area.y_percent + deltaY;
            newArea.width_percent = area.width_percent - deltaX;
            newArea.height_percent = area.height_percent - deltaY;
            break;
        }

        const clamped = clampArea(newArea);
        onAreaUpdate(area.id, clamped);
      }

      // ドラッグ移動処理
      if (draggingArea) {
        const area = tapAreas.find((a) => a.id === draggingArea);
        if (!area) return;

        const newArea = {
          ...area,
          x_percent: area.x_percent + deltaX,
          y_percent: area.y_percent + deltaY,
        };

        const clamped = clampArea(newArea);
        onAreaUpdate(area.id, clamped);
      }
    };

    const handleMouseUp = () => {
      setResizingArea(null);
      setResizeHandle(null);
      setDraggingArea(null);
    };

    if (resizingArea || draggingArea) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizingArea, resizeHandle, draggingArea, tapAreas, editorRef, onAreaUpdate, clampArea]);

  const aspectRatio = size === "full" ? 1686 / 2500 : 843 / 2500;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-green-600" />
            <CardTitle>LINE公式アカウント プレビュー</CardTitle>
          </div>
          <CardDescription>実際のLINEアプリでの表示イメージ</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mx-auto max-w-sm bg-white rounded-3xl shadow-2xl border overflow-hidden">
            {/* ステータスバー */}
            <div className="bg-black text-white text-xs p-1 flex justify-between items-center">
              <span>9:41</span>
              <div className="flex gap-1">
                <span>📶</span>
                <span>📶</span>
                <span>🔋</span>
              </div>
            </div>
            
            {/* LINE風ヘッダー */}
            <div className="bg-green-600 text-white p-3 flex items-center gap-3 shadow-sm">
              <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm">
                <span className="text-green-600 font-bold text-sm">L</span>
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm">LINE公式アカウント</div>
                <div className="text-xs opacity-90">オンライン</div>
              </div>
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full border border-white/30 flex items-center justify-center">
                  <span className="text-xs">📞</span>
                </div>
                <div className="w-6 h-6 rounded-full border border-white/30 flex items-center justify-center">
                  <span className="text-xs">⋯</span>
                </div>
              </div>
            </div>

            {/* チャット内容エリア */}
            <div className="h-32 bg-gradient-to-b from-gray-50 to-gray-100 p-3 flex flex-col justify-end">
              <div className="flex justify-start mb-2">
                <div className="bg-white rounded-2xl rounded-bl-md p-2 max-w-xs shadow-sm border text-xs">
                  <p className="text-gray-800">こんにちは！</p>
                  <p className="text-gray-800">リッチメニューをタップしてみてください✨</p>
                </div>
              </div>
              <div className="text-xs text-gray-500 text-center">
                {new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            {/* 入力エリア */}
            <div className="bg-white border-t border-gray-200 p-2 flex items-center gap-2">
              <div className="flex-1 bg-gray-100 rounded-full px-3 py-2 text-xs text-gray-500">
                メッセージを入力
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-green-600 hover:text-green-700 hover:bg-green-50 text-xs px-2"
              >
                {chatBarText}
              </Button>
            </div>

            {/* リッチメニューエリア */}
            <div className="relative border-t border-gray-200">
              <div
                ref={editorRef}
                className="relative w-full overflow-hidden bg-gray-100"
                style={{ aspectRatio: `${1 / aspectRatio}` }}
                onClick={() => onAreaSelect(null)}
              >
                {/* 背景画像 */}
                {backgroundImageUrl ? (
                  <img
                    src={backgroundImageUrl}
                    alt="Rich menu background"
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                    <div className="text-center text-gray-500">
                      <div className="text-lg mb-1">🖼️</div>
                      <p className="text-xs">背景画像を設定</p>
                    </div>
                  </div>
                )}

                {/* タップエリア */}
                {tapAreas.map((area) => (
                  <div
                    key={area.id}
                    className={`absolute group ${
                      selectedArea === area.id
                        ? "bg-blue-500/30 border-2 border-blue-600 shadow-lg"
                        : "bg-red-500/15 border border-red-500/50 hover:bg-red-500/25 hover:border-red-500 transition-colors"
                    } ${draggingArea === area.id || resizingArea === area.id ? "" : "cursor-pointer"}`}
                    style={{
                      left: `${area.x_percent}%`,
                      top: `${area.y_percent}%`,
                      width: `${area.width_percent}%`,
                      height: `${area.height_percent}%`,
                      borderRadius: '4px'
                    }}
                    onMouseDown={(e) => {
                      if (selectedArea === area.id && !resizingArea) {
                        handleDragMoveStart(e, area.id);
                      } else {
                        onMouseDown(e, area.id);
                      }
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAreaSelect(area.id);
                    }}
                  >
                    {/* エリア番号とアクション表示 */}
                    <div className="absolute top-1 left-1 bg-black/70 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                      <span className="font-medium">{tapAreas.indexOf(area) + 1}</span>
                      <span className="text-xs opacity-80">
                        {area.action_type === "uri" && "🔗"}
                        {area.action_type === "message" && "💬"}
                        {area.action_type === "richmenuswitch" && "📱"}
                      </span>
                    </div>

                    {/* リサイズハンドル */}
                    {selectedArea === area.id && (
                      <>
                        <div
                          className="absolute -top-1 -left-1 w-3 h-3 bg-blue-600 rounded-full cursor-nw-resize shadow-md z-10"
                          onMouseDown={(e) => handleResizeMouseDown(e, "nw", area.id)}
                        />
                        <div
                          className="absolute -top-1 -right-1 w-3 h-3 bg-blue-600 rounded-full cursor-ne-resize shadow-md z-10"
                          onMouseDown={(e) => handleResizeMouseDown(e, "ne", area.id)}
                        />
                        <div
                          className="absolute -bottom-1 -left-1 w-3 h-3 bg-blue-600 rounded-full cursor-sw-resize shadow-md z-10"
                          onMouseDown={(e) => handleResizeMouseDown(e, "sw", area.id)}
                        />
                        <div
                          className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-600 rounded-full cursor-se-resize shadow-md z-10"
                          onMouseDown={(e) => handleResizeMouseDown(e, "se", area.id)}
                        />

                        {/* 移動ハンドル */}
                        <div 
                          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-blue-600/90 rounded-full p-1 cursor-move z-10"
                          onMouseDown={(e) => handleDragMoveStart(e, area.id)}
                        >
                          <Move className="w-3 h-3 text-white" />
                        </div>
                      </>
                    )}

                    {/* ホバー時のアクション詳細 */}
                    {selectedArea !== area.id && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded text-white text-xs p-2">
                        <div className="text-center">
                          <div className="font-medium">
                            {area.action_type === "uri" && "URL"}
                            {area.action_type === "message" && "メッセージ"}
                            {area.action_type === "richmenuswitch" && "メニュー切替"}
                          </div>
                          <div className="text-xs opacity-90 truncate max-w-16">
                            {area.action_value || "未設定"}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            {/* ナビゲーションバー */}
            <div className="bg-white border-t border-gray-200 p-2 flex justify-center">
              <div className="w-1/3 h-1 bg-gray-300 rounded-full"></div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 選択エリアの詳細設定 */}
      {selectedAreaData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs">
                {tapAreas.indexOf(selectedAreaData) + 1}
              </span>
              タップエリア設定
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              <div>
                <Label className="text-xs text-gray-600">X座標 (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={selectedAreaData.x_percent.toFixed(1)}
                  onChange={(e) => handleManualUpdate("x_percent", parseFloat(e.target.value))}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600">Y座標 (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={selectedAreaData.y_percent.toFixed(1)}
                  onChange={(e) => handleManualUpdate("y_percent", parseFloat(e.target.value))}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600">幅 (%)</Label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  step="0.1"
                  value={selectedAreaData.width_percent.toFixed(1)}
                  onChange={(e) => handleManualUpdate("width_percent", parseFloat(e.target.value))}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600">高さ (%)</Label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  step="0.1"
                  value={selectedAreaData.height_percent.toFixed(1)}
                  onChange={(e) => handleManualUpdate("height_percent", parseFloat(e.target.value))}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <div className="pt-4 border-t">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                アクション設定
                <span className="text-lg">
                  {selectedAreaData.action_type === "uri" && "🔗"}
                  {selectedAreaData.action_type === "message" && "💬"}
                  {selectedAreaData.action_type === "richmenuswitch" && "📱"}
                </span>
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-gray-600">タイプ</Label>
                  <div className="text-sm bg-white p-2 rounded border">
                    {selectedAreaData.action_type === "uri" && "URL遷移"}
                    {selectedAreaData.action_type === "message" && "テキスト送信"}
                    {selectedAreaData.action_type === "richmenuswitch" && "リッチメニュー切り替え"}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-gray-600">値</Label>
                  <div className="text-sm bg-white p-2 rounded border break-all min-h-[2rem] flex items-center">
                    {selectedAreaData.action_value || (
                      <span className="text-gray-400 italic">未設定</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 情報表示 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">リッチメニュー情報</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">📐 サイズ:</span>
              <span className="font-medium">{size === "full" ? "フル (2500×1686px)" : "ハーフ (2500×843px)"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">📍 タップエリア:</span>
              <span className="font-medium">{tapAreas.length}/20 個</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">💾 ファイル制限:</span>
              <span className="font-medium">1MB以下</span>
            </div>
            {tapAreas.length === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mt-3">
                <p className="text-yellow-800 text-xs font-medium">⚠️ タップエリアが設定されていません</p>
                <p className="text-yellow-700 text-xs">エリアを追加してアクションを設定してください</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

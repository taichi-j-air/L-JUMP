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
  const previewRef = useRef<HTMLDivElement>(null);

  const selectedAreaData = tapAreas.find((area) => area.id === selectedArea);

  /** リサイズ開始 */
  const handleResizeMouseDown = useCallback((e: React.MouseEvent, handle: string, areaId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingArea(areaId);
    setResizeHandle(handle);
  }, []);

  /** 手入力更新 */
  const handleManualUpdate = (field: string, value: number) => {
    if (!selectedArea) return;
    const clampedValue = Math.max(0, Math.min(100, value));
    onAreaUpdate(selectedArea, { [field]: clampedValue });
  };

  /** マウス移動によるリサイズ処理 */
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingArea || !resizeHandle || !editorRef.current) return;

      const rect = editorRef.current.getBoundingClientRect();
      const deltaX = (e.movementX / rect.width) * 100;
      const deltaY = (e.movementY / rect.height) * 100;

      const area = tapAreas.find((a) => a.id === resizingArea);
      if (!area) return;

      let updates: Partial<TapArea> = {};

      switch (resizeHandle) {
        case "se": // 右下
          updates = {
            width_percent: Math.max(1, Math.min(100, area.width_percent + deltaX)),
            height_percent: Math.max(1, Math.min(100, area.height_percent + deltaY)),
          };
          break;
        case "sw": // 左下
          updates = {
            x_percent: Math.max(0, Math.min(100, area.x_percent + deltaX)),
            width_percent: Math.max(1, Math.min(100, area.width_percent - deltaX)),
            height_percent: Math.max(1, Math.min(100, area.height_percent + deltaY)),
          };
          break;
        case "ne": // 右上
          updates = {
            y_percent: Math.max(0, Math.min(100, area.y_percent + deltaY)),
            width_percent: Math.max(1, Math.min(100, area.width_percent + deltaX)),
            height_percent: Math.max(1, Math.min(100, area.height_percent - deltaY)),
          };
          break;
        case "nw": // 左上
          updates = {
            x_percent: Math.max(0, Math.min(100, area.x_percent + deltaX)),
            y_percent: Math.max(0, Math.min(100, area.y_percent + deltaY)),
            width_percent: Math.max(1, Math.min(100, area.width_percent - deltaX)),
            height_percent: Math.max(1, Math.min(100, area.height_percent - deltaY)),
          };
          break;
      }

      onAreaUpdate(area.id, updates);
    };

    const handleMouseUp = () => {
      setResizingArea(null);
      setResizeHandle(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizingArea, resizeHandle, tapAreas, editorRef, onAreaUpdate]);

  const aspectRatio = size === "full" ? 1686 / 2500 : 843 / 2500;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            <CardTitle>プレビュー</CardTitle>
          </div>
          <CardDescription>実際のLINE画面でのリッチメニュー表示イメージ</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mx-auto max-w-sm bg-white rounded-lg shadow-lg border overflow-hidden">
            {/* チャットヘッダー */}
            <div className="bg-green-500 text-white p-3 text-center font-medium">
              LINE公式アカウント
            </div>
            {/* チャット本文エリア */}
            <div className="h-40 bg-gray-50 p-4 flex items-center justify-center">
              <p className="text-gray-500 text-sm">チャット画面</p>
            </div>
            {/* チャットバー */}
            <div className="bg-white border-t p-2 flex items-center justify-between">
              <div className="flex-1 bg-gray-100 rounded-full px-3 py-2 text-sm">メッセージを入力</div>
              <Button
                variant="ghost"
                size="sm"
                className="ml-2 text-green-600 hover:text-green-700 hover:bg-green-50"
              >
                {chatBarText}
              </Button>
            </div>
            {/* リッチメニューエリア */}
            <div className="relative bg-gray-100">
              <div
                ref={editorRef}
                className="relative w-full overflow-hidden"
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
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                    <p className="text-gray-500 text-sm">背景画像を選択してください</p>
                  </div>
                )}

                {/* タップエリア */}
                {tapAreas.map((area) => (
                  <div
                    key={area.id}
                    className={`absolute cursor-pointer group ${
                      selectedArea === area.id
                        ? "bg-primary/30 border-2 border-primary"
                        : "bg-blue-500/20 border border-blue-500/50 hover:bg-blue-500/30"
                    }`}
                    style={{
                      left: `${area.x_percent}%`,
                      top: `${area.y_percent}%`,
                      width: `${area.width_percent}%`,
                      height: `${area.height_percent}%`,
                    }}
                    onMouseDown={(e) => onMouseDown(e, area.id)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAreaSelect(area.id);
                    }}
                  >
                    {/* エリア番号 */}
                    <div className="absolute top-0 left-0 bg-primary text-primary-foreground text-xs px-1 rounded-br">
                      {tapAreas.indexOf(area) + 1}
                    </div>

                    {/* リサイズハンドル */}
                    {selectedArea === area.id && (
                      <>
                        <div
                          className="absolute -top-1 -left-1 w-3 h-3 bg-primary rounded-full cursor-nw-resize"
                          onMouseDown={(e) => handleResizeMouseDown(e, "nw", area.id)}
                        />
                        <div
                          className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full cursor-ne-resize"
                          onMouseDown={(e) => handleResizeMouseDown(e, "ne", area.id)}
                        />
                        <div
                          className="absolute -bottom-1 -left-1 w-3 h-3 bg-primary rounded-full cursor-sw-resize"
                          onMouseDown={(e) => handleResizeMouseDown(e, "sw", area.id)}
                        />
                        <div
                          className="absolute -bottom-1 -right-1 w-3 h-3 bg-primary rounded-full cursor-se-resize"
                          onMouseDown={(e) => handleResizeMouseDown(e, "se", area.id)}
                        />

                        {/* 移動ハンドル */}
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                          <Move className="w-4 h-4 text-primary" />
                        </div>
                      </>
                    )}

                    {/* アクション情報 */}
                    <div className="absolute bottom-1 right-1 text-xs bg-black/75 text-white px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                      {area.action_type === "uri" && "🔗"}
                      {area.action_type === "message" && "💬"}
                      {area.action_type === "richmenuswitch" && "🔄"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 選択エリアの詳細設定 */}
      {selectedAreaData && (
        <Card>
          <CardHeader>
            <CardTitle>エリア {tapAreas.indexOf(selectedAreaData) + 1} - 詳細設定</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>X座標 (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={selectedAreaData.x_percent.toFixed(1)}
                  onChange={(e) => handleManualUpdate("x_percent", parseFloat(e.target.value))}
                />
              </div>
              <div>
                <Label>Y座標 (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={selectedAreaData.y_percent.toFixed(1)}
                  onChange={(e) => handleManualUpdate("y_percent", parseFloat(e.target.value))}
                />
              </div>
              <div>
                <Label>幅 (%)</Label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  step="0.1"
                  value={selectedAreaData.width_percent.toFixed(1)}
                  onChange={(e) => handleManualUpdate("width_percent", parseFloat(e.target.value))}
                />
              </div>
              <div>
                <Label>高さ (%)</Label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  step="0.1"
                  value={selectedAreaData.height_percent.toFixed(1)}
                  onChange={(e) => handleManualUpdate("height_percent", parseFloat(e.target.value))}
                />
              </div>
            </div>

            <div className="pt-4 border-t">
              <h4 className="font-medium mb-2">アクション設定</h4>
              <div className="text-sm space-y-1">
                <div>
                  <span className="font-medium">タイプ:</span>{" "}
                  {selectedAreaData.action_type === "uri" && "URL遷移"}
                  {selectedAreaData.action_type === "message" && "テキスト送信"}
                  {selectedAreaData.action_type === "richmenuswitch" && "リッチメニュー切り替え"}
                </div>
                <div>
                  <span className="font-medium">値:</span>{" "}
                  <span className="break-all">{selectedAreaData.action_value || "未設定"}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* サイズ情報 */}
      <Card>
        <CardHeader>
          <CardTitle>サイズ情報</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm space-y-2">
            <div>
              <span className="font-medium">現在のサイズ:</span> {size === "full" ? "フル" : "ハーフ"}
            </div>
            <div>
              <span className="font-medium">推奨解像度:</span> {size === "full" ? "2500×1686px" : "2500×843px"}
            </div>
            <div>
              <span className="font-medium">ファイルサイズ:</span> 1MB以下
            </div>
            <div>
              <span className="font-medium">タップエリア数:</span> {tapAreas.length}/20
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

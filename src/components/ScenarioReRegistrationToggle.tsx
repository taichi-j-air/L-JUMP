import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Shield, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ScenarioReRegistrationToggleProps {
  scenarioId: string;
  preventReRegistration: boolean;
  scenarioName: string;
  onUpdate?: (newValue: boolean) => void;
}

export const ScenarioReRegistrationToggle = ({
  scenarioId,
  preventReRegistration,
  scenarioName,
  onUpdate,
}: ScenarioReRegistrationToggleProps) => {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleToggle = async () => {
    const newValue = !preventReRegistration;
    
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("step_scenarios")
        .update({ prevent_re_registration: newValue })
        .eq("id", scenarioId);

      if (error) throw error;

      toast.success(
        newValue
          ? "再登録禁止を有効にしました"
          : "再登録許可を有効にしました"
      );

      onUpdate?.(newValue);
    } catch (error) {
      console.error("Error updating re-registration setting:", error);
      toast.error("設定の更新に失敗しました");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <CardTitle>シナリオ再登録制御設定</CardTitle>
        </div>
        <CardDescription>
          このシナリオへの再登録を制御します。招待コード個別設定で上書き可能です。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="prevent-re-registration" className="text-base">
              再登録を禁止する
            </Label>
            <p className="text-sm text-muted-foreground">
              同じユーザーが同じ招待コードで再登録できないようにします
            </p>
          </div>
          <Switch
            id="prevent-re-registration"
            checked={preventReRegistration}
            onCheckedChange={handleToggle}
            disabled={isUpdating}
          />
        </div>

        <div className="rounded-lg border p-4">
          <div className="flex items-start gap-3">
            {preventReRegistration ? (
              <>
                <Shield className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">再登録禁止 ON</span>
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                      保護中
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    同じユーザーは一度しか登録できません。重複登録時にはカスタムメッセージが表示されます。
                  </p>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">適用例：</p>
                    <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                      <li>有料コンテンツや限定キャンペーン</li>
                      <li>一人一回限りの特典配布</li>
                      <li>重複申込を防ぎたい教育コンテンツ</li>
                    </ul>
                  </div>
                </div>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">再登録許可 ON</span>
                    <span className="inline-flex items-center rounded-full bg-green-500/10 px-2 py-1 text-xs font-medium text-green-600">
                      許可中
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    同じユーザーが何度でも登録でき、シナリオが最初からリスタートされます。
                  </p>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">適用例：</p>
                    <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                      <li>体験版や無料トライアルコンテンツ</li>
                      <li>何度でも利用できるサポート窓口</li>
                      <li>繰り返し学習できる教材</li>
                    </ul>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {preventReRegistration && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                  招待コード個別設定で上書き可能
                </p>
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  各招待コードの詳細設定で「再登録を許可する」を個別に設定できます。
                  テスト用や特別な用途の招待コードには異なる設定を適用できます。
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

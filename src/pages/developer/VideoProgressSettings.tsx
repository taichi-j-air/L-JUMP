import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { ArrowLeft, Save, Play } from "lucide-react";

interface VideoProgressConfig {
  id: string;
  video_type: string;
  completion_percentage: number;
  show_timer: boolean;
  video_duration?: number;
}

const VideoProgressSettings = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [configs, setConfigs] = useState<VideoProgressConfig[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    checkUserAndLoadData();
  }, []);

  const checkUserAndLoadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        navigate("/auth");
        return;
      }

      setUser(session.user);

      // 開発者権限チェック
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_role')
        .eq('user_id', session.user.id)
        .single();

      if (!profile || profile.user_role !== 'developer') {
        navigate("/");
        return;
      }

      await loadVideoConfigs();
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("データの読み込みに失敗しました");
    }
  };

  const loadVideoConfigs = async () => {
    try {
      const { data: existingConfigs, error } = await supabase
        .from('onboarding_videos')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading video configs:', error);
        return;
      }

      if (existingConfigs && existingConfigs.length > 0) {
                // ステップ4動画設定と使い方動画設定の重複を除去（usage_tutorialのみ残す）
                const filteredConfigs = existingConfigs.filter(config => {
                  if (config.video_type === 'step4') return false; // step4は除外
                  return true;
                });
                
                setConfigs(filteredConfigs.map(config => ({
                  id: config.id,
                  video_type: config.video_type,
                  completion_percentage: config.completion_percentage || 100,
                  show_timer: config.show_timer ?? true,
                  video_duration: config.video_duration || undefined
                })));
      }
    } catch (error) {
      console.error("Error loading video configs:", error);
    }
  };

  const handleConfigUpdate = (id: string, field: string, value: any) => {
    setConfigs(prev => prev.map(config => 
      config.id === id ? { ...config, [field]: value } : config
    ));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      for (const config of configs) {
        const { error } = await supabase
          .from('onboarding_videos')
          .update({
            completion_percentage: config.completion_percentage,
            show_timer: config.show_timer,
            video_duration: config.video_duration
          })
          .eq('id', config.id);

        if (error) {
          console.error(`Error saving config ${config.id}:`, error);
          throw error;
        }
      }
      
      toast.success("動画進捗設定を保存しました");
    } catch (error) {
      console.error("Error saving video configs:", error);
      toast.error("動画進捗設定の保存に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const getVideoTypeLabel = (videoType: string) => {
    const labels: { [key: string]: string } = {
      'usage_tutorial': '使い方動画',
      'channel_id': 'チャネルID設定動画',
      'channel_secret': 'チャネルシークレット設定動画',
      'line_bot_id': 'LINEボットID設定動画',
      'channel_access_token': 'チャネルアクセストークン設定動画'
    };
    return labels[videoType] || videoType;
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="container mx-auto px-4">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Play className="w-6 h-6" />
              動画進捗設定
            </h1>
            <p className="text-muted-foreground">オンボーディング動画の視聴進捗設定を管理できます。</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/developer/onboarding-video-management")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            動画管理に戻る
          </Button>
        </div>

        <div className="space-y-6">
          {configs.map((config) => (
            <Card key={config.id}>
              <CardHeader>
                <CardTitle>{getVideoTypeLabel(config.video_type)}</CardTitle>
                <CardDescription>視聴進捗とタイマー設定</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`completion-${config.id}`}>
                      次のステップに進む視聴率 (%)
                    </Label>
                    <Input
                      id={`completion-${config.id}`}
                      type="number"
                      min="0"
                      max="100"
                      value={config.completion_percentage}
                      onChange={(e) => handleConfigUpdate(config.id, 'completion_percentage', parseInt(e.target.value) || 0)}
                    />
                    <p className="text-xs text-muted-foreground">
                      この割合まで視聴すると次のステップボタンが有効になります
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`duration-${config.id}`}>
                      動画時間（秒）
                    </Label>
                    <Input
                      id={`duration-${config.id}`}
                      type="number"
                      min="0"
                      value={config.video_duration || ''}
                      onChange={(e) => handleConfigUpdate(config.id, 'video_duration', parseInt(e.target.value) || null)}
                      placeholder="自動取得"
                    />
                    <p className="text-xs text-muted-foreground">
                      空白の場合は動画から自動取得されます
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`timer-${config.id}`}>
                      タイマー表示
                    </Label>
                    <Select
                      value={config.show_timer ? "true" : "false"}
                      onValueChange={(value) => handleConfigUpdate(config.id, 'show_timer', value === "true")}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">表示する</SelectItem>
                        <SelectItem value="false">表示しない</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      視聴進捗タイマーの表示設定
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8 flex justify-end">
          <Button onClick={handleSave} disabled={loading}>
            <Save className="w-4 h-4 mr-2" />
            {loading ? "保存中..." : "すべて保存"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default VideoProgressSettings;
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { ArrowLeft, Save, Video } from "lucide-react";

interface VideoSetting {
  id: string;
  title: string;
  description: string;
  url: string;
  embed_code: string;
}

const OnboardingVideoManagement = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [videos, setVideos] = useState<VideoSetting[]>([
    {
      id: "usage_tutorial",
      title: "使い方動画",
      description: "L!JUMPの基本的な使い方",
      url: "",
      embed_code: ""
    },
    {
      id: "channel_id",
      title: "チャネルID設定動画",
      description: "LINEチャネルIDの取得方法",
      url: "",
      embed_code: ""
    },
    {
      id: "channel_secret",
      title: "チャネルシークレット設定動画",
      description: "LINEチャネルシークレットの取得方法",
      url: "",
      embed_code: ""
    },
    {
      id: "line_bot_id",
      title: "LINEボットID設定動画",
      description: "LINEボットIDの取得方法",
      url: "",
      embed_code: ""
    },
    {
      id: "channel_access_token",
      title: "チャネルアクセストークン設定動画",
      description: "チャネルアクセストークンの取得方法",
      url: "",
      embed_code: ""
    }
  ]);
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

      await loadVideoSettings();
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("データの読み込みに失敗しました");
    }
  };

  const loadVideoSettings = async () => {
    try {
      const { data: existingVideos, error } = await supabase
        .from('onboarding_videos')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading videos:', error);
        return;
      }

      // 既存のデータがある場合は更新
      if (existingVideos && existingVideos.length > 0) {
        setVideos(prev => prev.map(video => {
          const existing = existingVideos.find(v => v.video_type === video.id);
          if (existing) {
            return {
              ...video,
              url: existing.video_url || '',
              embed_code: existing.custom_text || ''
            };
          }
          return video;
        }));
      }
    } catch (error) {
      console.error("Error loading video settings:", error);
    }
  };

  const handleVideoUpdate = (id: string, field: string, value: string) => {
    setVideos(prev => prev.map(video => 
      video.id === id ? { ...video, [field]: value } : video
    ));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // 各動画設定をデータベースに保存
      for (const video of videos) {
        if (!video.url.trim()) continue; // 空のURLはスキップ

        const { error } = await supabase
          .from('onboarding_videos')
          .upsert({
            video_type: video.id,
            video_url: video.url,
            custom_text: video.embed_code,
            video_duration: null, // 必要に応じて設定
            completion_percentage: 100,
            show_timer: true
          }, {
            onConflict: 'video_type'
          });

        if (error) {
          console.error(`Error saving video ${video.id}:`, error);
          throw error;
        }
      }
      
      toast.success("動画設定を保存しました");
    } catch (error) {
      console.error("Error saving video settings:", error);
      toast.error("動画設定の保存に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <AppHeader user={user} />
      
      <div className="container mx-auto px-4">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Video className="w-6 h-6" />
              オンボーディング動画管理
            </h1>
            <p className="text-muted-foreground">オンボーディングで表示される動画を管理できます。</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/developer/video-progress-settings")}>
              動画進捗設定
            </Button>
            <Button variant="outline" onClick={() => navigate("/developer/master-mode")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              戻る
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          {videos.map((video) => (
            <Card key={video.id}>
              <CardHeader>
                <CardTitle>{video.title}</CardTitle>
                <CardDescription>{video.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={`url-${video.id}`}>動画URL</Label>
                  <Input
                    id={`url-${video.id}`}
                    value={video.url}
                    onChange={(e) => handleVideoUpdate(video.id, 'url', e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor={`embed-${video.id}`}>埋め込みコード</Label>
                  <Textarea
                    id={`embed-${video.id}`}
                    value={video.embed_code}
                    onChange={(e) => handleVideoUpdate(video.id, 'embed_code', e.target.value)}
                    placeholder="<iframe src=... ></iframe>"
                    rows={4}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    YouTubeやVimeoなどの埋め込みコードを貼り付けてください
                  </p>
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

export default OnboardingVideoManagement;
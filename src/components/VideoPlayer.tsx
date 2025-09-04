import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface VideoPlayerProps {
  videoType: string;
  onVideoComplete?: () => void;
  showTimer?: boolean;
  customText?: string;
  requiredCompletionPercentage?: number;
  disabled?: boolean;
  videoViewingRequired?: boolean;
}

interface VideoData {
  video_url: string;
  video_duration: number;
  completion_percentage: number;
  show_timer: boolean;
  custom_text: string | null;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoType,
  onVideoComplete,
  showTimer = true,
  customText,
  requiredCompletionPercentage = 100,
  disabled = false,
  videoViewingRequired = true
}) => {
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [watchProgress, setWatchProgress] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const completionHandledRef = useRef(false);

  // コールバックをメモ化して安定化
  const handleCompletion = useCallback(() => {
    if (!completionHandledRef.current && !isCompleted) {
      completionHandledRef.current = true;
      setIsCompleted(true);
      stopTimer();
      onVideoComplete?.();
    }
  }, [onVideoComplete, isCompleted]);

  // 初期データ読み込み
  useEffect(() => {
    loadVideoData();
    loadWatchProgress();
  }, [videoType]);

  // 動画視聴が不要な場合の自動完了（無限ループ修正）
  useEffect(() => {
    console.log('VideoPlayer: videoViewingRequired changed', { videoViewingRequired, isCompleted });
    if (!videoViewingRequired && !isCompleted && !completionHandledRef.current) {
      console.log('VideoPlayer: auto-completing because video viewing not required');
      handleCompletion();
    }
  }, [videoViewingRequired, handleCompletion]); // isCompletedを依存配列から除外

  // 進捗による完了判定（無限ループ修正）
  useEffect(() => {
    console.log('VideoPlayer: watch progress changed', { watchProgress, videoData, isCompleted });
    if (videoData && watchProgress > 0 && !isCompleted && !completionHandledRef.current) {
      const completionPercentage = (watchProgress / videoData.video_duration) * 100;
      const requiredPercentage = requiredCompletionPercentage || videoData.completion_percentage;
      
      if (completionPercentage >= requiredPercentage) {
        console.log('VideoPlayer: completing due to watch progress', { completionPercentage, requiredPercentage });
        handleCompletion();
        return;
      }
      
      // 残り時間の計算
      const remaining = Math.max(0, Math.ceil((videoData.video_duration * requiredPercentage / 100) - watchProgress));
      setTimeRemaining(remaining);
    }
  }, [watchProgress, videoData, requiredCompletionPercentage, handleCompletion]); // isCompletedを依存配列から除外

  // 動画データが存在しない場合の自動完了（無限ループ修正）
  useEffect(() => {
    console.log('VideoPlayer: video data check', { loading, videoData, isCompleted });
    if (!loading && !videoData && !isCompleted && !completionHandledRef.current) {
      console.log('VideoPlayer: auto-completing because no video data');
      handleCompletion();
    }
  }, [loading, videoData, handleCompletion]); // isCompletedを依存配列から除外

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  const loadVideoData = async () => {
    try {
      const { data, error } = await supabase
        .from('onboarding_videos')
        .select('*')
        .eq('video_type', videoType)
        .maybeSingle(); // .single() から .maybeSingle() に変更（406エラー修正）

      if (error) throw error;
      setVideoData(data); // dataがnullでもエラーにならない
    } catch (error) {
      console.error('Error loading video data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadWatchProgress = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) return;

      const { data, error } = await supabase
        .from('video_watch_progress')
        .select('*')
        .eq('user_id', session.session.user.id)
        .eq('video_type', videoType)
        .maybeSingle(); // .single() から .maybeSingle() に変更（406エラー修正）

      if (data) {
        setWatchProgress(data.watch_time);
        if (data.is_completed) {
          setIsCompleted(true);
          completionHandledRef.current = true;
        }
      }
    } catch (error) {
      console.error('Error loading watch progress:', error);
    }
  };

  const saveWatchProgress = async (currentWatchTime: number) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user || !videoData) return;

      const completionPercentage = (currentWatchTime / videoData.video_duration) * 100;
      const requiredPercentage = requiredCompletionPercentage || videoData.completion_percentage;
      const completed = completionPercentage >= requiredPercentage;

      await supabase
        .from('video_watch_progress')
        .upsert({
          user_id: session.session.user.id,
          video_type: videoType,
          watch_time: currentWatchTime,
          completion_percentage: completionPercentage,
          is_completed: completed
        });
    } catch (error) {
      console.error('Error saving watch progress:', error);
    }
  };

  const startTimer = () => {
    if (intervalRef.current || isCompleted) return;
    
    setIsPlaying(true);
    intervalRef.current = setInterval(() => {
      setWatchProgress(prev => {
        const newProgress = prev + 1;
        saveWatchProgress(newProgress);
        return newProgress;
      });
    }, 1000);
  };

  const stopTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPlaying(false);
  };

  const handleVideoPlay = () => {
    if (!disabled && !isCompleted) {
      startTimer();
    }
  };

  const handleVideoPause = () => {
    stopTimer();
  };

  const getEmbedUrl = (url: string): string => {
    if (!url) return '';
    
    // YouTubeのURLを埋め込み形式に変換
    const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(youtubeRegex);
    
    if (match) {
      const videoId = match[1];
      return `https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}&rel=0&modestbranding=1`;
    }
    
    return url; // 既に埋め込み形式の場合はそのまま返す
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}分${remainingSeconds}秒`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-[630px] bg-muted rounded-lg">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!videoData) {
    return (
      <div className="flex items-center justify-center w-full h-[630px] bg-muted rounded-lg">
        <p className="text-muted-foreground">動画が設定されていません</p>
      </div>
    );
  }

  const showTimerDisplay = showTimer && (videoData.show_timer || disabled);
  const displayText = customText || videoData.custom_text;

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="aspect-video bg-muted rounded-lg w-full max-w-5xl mx-auto">
          {videoData.video_url ? (
            <iframe
              ref={iframeRef}
              width="1120"
              height="630"
              src={getEmbedUrl(videoData.video_url)}
              title={`${videoType} 動画`}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="rounded-lg w-full h-full"
              sandbox="allow-scripts allow-same-origin allow-presentation"
              onLoad={() => {
                console.log('Video iframe loaded for:', videoType);
                // YouTube iframe API integration would go here for real video tracking
                // For demo purposes, we'll simulate video play detection
                const simulateVideoPlay = () => {
                  if (!disabled && !isCompleted) {
                    handleVideoPlay();
                  }
                };
                setTimeout(simulateVideoPlay, 2000);
              }}
              onError={(e) => {
                console.error('Video iframe error:', e);
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">動画URLが設定されていません</p>
            </div>
          )}
        </div>
        
        {disabled && !isCompleted && (
          <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
            <div className="text-center text-white">
              <p className="text-lg font-semibold mb-2">動画視聴が必要です</p>
              <p className="text-sm">この動画を最後まで視聴してください</p>
            </div>
          </div>
        )}
      </div>

      {displayText && (
        <div className="text-center">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{displayText}</p>
        </div>
      )}

      {showTimerDisplay && !isCompleted && videoData && (
        <div className="text-center">
          <p className="text-sm font-medium">
            次のステップボタンが表示されるまで残り {formatTime(timeRemaining)}
          </p>
          <div className="w-full bg-muted rounded-full h-2 mt-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ 
                width: `${Math.min(100, (watchProgress / (videoData.video_duration * (requiredCompletionPercentage || videoData.completion_percentage) / 100)) * 100)}%` 
              }}
            />
          </div>
        </div>
      )}

      {isCompleted && (
        <div className="text-center">
          <p className="text-green-600 font-semibold">✓ 動画視聴完了</p>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, Maximize, Volume2, VolumeX } from "lucide-react";
import { Slider } from "@/components/ui/slider";

interface LVideoPlayerProps {
  videoUrl: string;
  onProgress?: (currentTime: number, duration: number) => void;
  onVideoComplete?: () => void;
  requiredCompletionPercentage?: number;
  customText?: string;
  showTimer?: boolean;
  autoPlay?: boolean;
}

const LVideoPlayer: React.FC<LVideoPlayerProps> = ({
  videoUrl,
  onProgress,
  onVideoComplete,
  requiredCompletionPercentage = 100,
  customText,
  showTimer = true,
  autoPlay = false
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isCompleted, setIsCompleted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const completionHandledRef = useRef(false);

  // Progress tracking
  useEffect(() => {
    if (duration > 0) {
      const progressPercentage = (currentTime / duration) * 100;
      setProgress(progressPercentage);
      
      const requiredTime = (duration * requiredCompletionPercentage) / 100;
      const remaining = Math.max(0, Math.ceil(requiredTime - currentTime));
      setTimeRemaining(remaining);
      
      // Check completion
      if (progressPercentage >= requiredCompletionPercentage && !completionHandledRef.current) {
        completionHandledRef.current = true;
        setIsCompleted(true);
        onVideoComplete?.();
      }
      
      onProgress?.(currentTime, duration);
    }
  }, [currentTime, duration, requiredCompletionPercentage, onProgress, onVideoComplete]);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
  }, [isPlaying]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => setIsPlaying(false);

  const handleSeek = (value: number[]) => {
    if (videoRef.current && duration > 0) {
      const time = (value[0] / 100) * duration;
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0] / 100;
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      setIsMuted(newMuted);
      videoRef.current.muted = newMuted;
    }
  };

  const handlePlaybackRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen();
    }
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatTimeRemaining = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}分${remainingSeconds}秒`;
  };

  return (
    <div className="space-y-4">
      <div ref={containerRef} className="relative bg-black rounded-lg overflow-hidden aspect-video">
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full object-contain"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={handlePlay}
          onPause={handlePause}
          autoPlay={autoPlay}
          preload="metadata"
        />
        
        {/* Controls overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          {/* Progress bar */}
          <div className="mb-3">
            <Slider
              value={[duration > 0 ? (currentTime / duration) * 100 : 0]}
              onValueChange={handleSeek}
              max={100}
              step={0.1}
              className="w-full"
            />
          </div>
          
          {/* Controls */}
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={togglePlay}
                className="text-white hover:bg-white/20 p-2"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleMute}
                  className="text-white hover:bg-white/20 p-2"
                >
                  {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </Button>
                <div className="w-20">
                  <Slider
                    value={[isMuted ? 0 : volume * 100]}
                    onValueChange={handleVolumeChange}
                    max={100}
                    step={1}
                    className="w-full"
                  />
                </div>
              </div>
              
              <span className="text-sm">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Playback speed */}
              <select
                value={playbackRate}
                onChange={(e) => handlePlaybackRateChange(parseFloat(e.target.value))}
                className="bg-transparent text-white text-sm border border-white/30 rounded px-2 py-1"
              >
                <option value={0.5} className="text-black">0.5x</option>
                <option value={0.75} className="text-black">0.75x</option>
                <option value={1} className="text-black">1x</option>
                <option value={1.25} className="text-black">1.25x</option>
                <option value={1.5} className="text-black">1.5x</option>
                <option value={2} className="text-black">2x</option>
              </select>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleFullscreen}
                className="text-white hover:bg-white/20 p-2"
              >
                <Maximize className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      {customText && (
        <div className="text-center">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{customText}</p>
        </div>
      )}
      
      {showTimer && !isCompleted && duration > 0 && requiredCompletionPercentage < 100 && (
        <div className="text-center">
          <p className="text-sm font-medium">
            次のステップボタンが表示されるまで残り {formatTimeRemaining(timeRemaining)}
          </p>
          <div className="w-full bg-muted rounded-full h-2 mt-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ 
                width: `${Math.min(100, (progress / requiredCompletionPercentage) * 100)}%` 
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

export default LVideoPlayer;
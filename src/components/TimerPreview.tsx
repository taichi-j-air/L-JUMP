'use client';
import { useEffect, useMemo, useRef, useState } from "react";

export type TimerMode = "absolute" | "per_access";
export type TimerStyle = "solid" | "glass" | "outline";

interface TimerPreviewProps {
  mode: TimerMode;
  deadline?: string | null;              // absolute のときのISO/ローカル日時
  durationSeconds?: number | null;       // per_access のときの秒
  showMilliseconds?: boolean;
  styleVariant?: TimerStyle;
  bgColor?: string;
  textColor?: string;
  shareCode?: string;                    // per_access のキー
  uid?: string;                          // per_access のキー
  className?: string;
  dayLabel?: string;
  hourLabel?: string;
  minuteLabel?: string;
  secondLabel?: string;
  preview?: boolean;
  internalTimer?: boolean;               // 非表示モード
  timerText?: string;                    // 非表示モード時テキスト
  showEndDate?: boolean;                 // 終了日時を表示
}

// 差分(ミリ秒)→ 正規化済みの日/時/分/秒
function calcPartsFromMs(diffMs: number) {
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const restAfterDays = totalSeconds - days * 86400;
  const hours = Math.floor(restAfterDays / 3600);                  // 0..23
  const restAfterHours = restAfterDays - hours * 3600;
  const minutes = Math.floor(restAfterHours / 60);                 // 0..59
  const seconds = restAfterHours - minutes * 60;                   // 0..59
  const milli = Math.max(0, diffMs % 1000);
  return { days, hours, minutes, seconds, milli };
}

export const TimerPreview = ({
  mode,
  deadline,
  durationSeconds,
  showMilliseconds = false,
  styleVariant = "solid",
  bgColor = "#0cb386",
  textColor = "#ffffff",
  shareCode,
  uid,
  className,
  dayLabel = "日",
  hourLabel = "時間",
  minuteLabel = "分",
  secondLabel = "秒",
  preview = false,
  internalTimer = false,
  timerText = "期間限定公開",
  showEndDate = false,
}: TimerPreviewProps) => {
  const [remainingMs, setRemainingMs] = useState<number>(0);
  const intervalRef = useRef<number | null>(null);

  // ms混入データの自動補正
  const safeDurationSeconds = useMemo(() => {
    let sec = Number(durationSeconds ?? 0);
    // 30日(=2592000s)超 & 1000の倍数 → ms疑い
    if (sec > 2_592_000 && sec % 1000 === 0) sec = Math.floor(sec / 1000);
    return sec;
  }, [durationSeconds]);

  // 残り時間の唯一の真実: targetTime
  const targetTime = useMemo(() => {
    if (mode === "absolute" && deadline) {
      return new Date(deadline).getTime(); // datetime-localはローカルとして解釈される
    }
    if (mode === "per_access" && safeDurationSeconds > 0) {
      if (preview) return Date.now() + safeDurationSeconds * 1000;
      const key = `cms_page_first_access:${shareCode || ""}:${uid || "anon"}`;
      const stored = typeof window !== "undefined" ? localStorage.getItem(key) : null;
      const start = stored ? Number(stored) : Date.now();
      if (!stored && typeof window !== "undefined") localStorage.setItem(key, String(start));
      return start + safeDurationSeconds * 1000;
    }
    return Date.now();
  }, [mode, deadline, safeDurationSeconds, shareCode, uid, preview]);

  // tick
  useEffect(() => {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    const tick = () => setRemainingMs(Math.max(0, targetTime - Date.now()));
    tick();
    intervalRef.current = window.setInterval(tick, showMilliseconds ? 50 : 500);
    return () => { if (intervalRef.current) window.clearInterval(intervalRef.current); };
  }, [targetTime, showMilliseconds]);

  const { days, hours, minutes, seconds, milli } = useMemo(
    () => calcPartsFromMs(remainingMs), [remainingMs]
  );

  // 表示ルール
  let base: string;
  if (days > 0 && hours === 0 && minutes === 0 && seconds === 0) {
    base = `残り${days}${dayLabel}`;
  } else if (days > 0) {
    base = `残り${days}${dayLabel}${hours}${hourLabel}${minutes}${minuteLabel}${seconds}${secondLabel}`;
  } else {
    base = `残り${hours}${hourLabel}${minutes}${minuteLabel}${seconds}${secondLabel}`;
  }

  const text = internalTimer
    ? timerText
    : showMilliseconds
      ? `${base}${milli.toString().padStart(3, "0")}`
      : base;

  const endDateText = useMemo(() => {
    if (!showEndDate) return null;
    const endDate = new Date(targetTime);
    const y = endDate.getFullYear();
    const mo = endDate.getMonth() + 1;
    const d = endDate.getDate();
    const hh = endDate.getHours().toString().padStart(2, "0");
    const mm = endDate.getMinutes().toString().padStart(2, "0");
    return `${y}年${mo}月${d}日 ${hh}時${mm}分まで`;
  }, [targetTime, showEndDate]);

  const styleClasses = {
    solid: "rounded-md p-3",
    glass: "rounded-md p-3 backdrop-blur border border-white/20",
    outline: "rounded-md p-3 border",
  } as const;

  const containerStyle: React.CSSProperties = {
    background: styleVariant === "glass" ? `${bgColor}20` : bgColor,
    color: textColor,
    borderColor: styleVariant === "outline" ? textColor : undefined,
  };

  return (
    <div className={className} data-testid="timer-preview-v3">
      <div className={styleClasses[styleVariant]} style={containerStyle}>
        <div className="text-xl font-semibold tracking-wide">{text}</div>
        {showEndDate && endDateText && (
          <div className="text-sm mt-1 opacity-80">{endDateText}</div>
        )}
      </div>
    </div>
  );
};

export default TimerPreview;

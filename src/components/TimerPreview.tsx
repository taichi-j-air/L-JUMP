import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TimerMode = "absolute" | "per_access" | "step_delivery";
export type TimerStyle = "solid" | "glass" | "outline" | "minimal";

interface TimerPreviewProps {
  mode: TimerMode;
  deadline?: string | null;          // absolute の締切（ISO）
  durationSeconds?: number | null;   // per_access / step_delivery の秒数
  showMilliseconds?: boolean;
  styleVariant?: TimerStyle;         // solid / glass(画像①) / outline(画像②) / minimal(画像③)
  bgColor?: string;                  // 背景色（solid などに反映）
  textColor?: string;                // 文字色（solid などに反映）
  shareCode?: string;
  uid?: string;
  className?: string;
  dayLabel?: string;
  hourLabel?: string;
  minuteLabel?: string;
  secondLabel?: string;
  preview?: boolean;
  internalTimer?: boolean;           // 内部タイマーテキスト固定表示
  timerText?: string;                // 内部タイマーテキスト
  showEndDate?: boolean;             // 終了日時の表示
  scenarioId?: string;               // step_delivery 用
  stepId?: string;                   // step_delivery 用
}

function splitTime(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}

const pad2 = (n: number) => n.toString().padStart(2, "0");

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
  scenarioId,
  stepId,
}: TimerPreviewProps) => {
  const [remainingMs, setRemainingMs] = useState<number>(0);
  const [serverSyncedStart, setServerSyncedStart] = useState<Date | null>(null);
  const [serverSyncExpired, setServerSyncExpired] = useState<boolean>(false);
  const intervalRef = useRef<number | null>(null);

  // サーバー同期（per_access / step_delivery）
  useEffect(() => {
    const run = async () => {
      if (shareCode && (mode === "per_access" || mode === "step_delivery") && !preview) {
        try {
          const { data, error } = await supabase.functions.invoke("get-timer-info", {
            body: { pageShareCode: shareCode, uid },
          });
          if (!error && data?.success && data?.timer_start_at) {
            setServerSyncedStart(new Date(data.timer_start_at));
            setServerSyncExpired(!!data.expired);
          }
        } catch {
          // noop
        }
      }
    };
    run();
  }, [shareCode, uid, mode, preview]);

  // 目標時刻
  const targetTime = useMemo(() => {
    if (mode === "absolute" && deadline) {
      const t = new Date(deadline).getTime();
      return isNaN(t) ? Date.now() : t;
    }
    if ((mode === "per_access" || mode === "step_delivery") && durationSeconds && durationSeconds > 0) {
      if (preview) return Date.now() + durationSeconds * 1000;
      if (serverSyncedStart) return serverSyncedStart.getTime() + durationSeconds * 1000;
      return Date.now() + durationSeconds * 1000;
    }
    return Date.now();
  }, [mode, deadline, durationSeconds, serverSyncedStart, preview]);

  // Tick
  useEffect(() => {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    const tick = () => setRemainingMs(Math.max(0, targetTime - Date.now()));
    tick();
    intervalRef.current = window.setInterval(tick, showMilliseconds ? 50 : 500);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [targetTime, showMilliseconds]);

  const { days, hours, minutes, seconds } = splitTime(remainingMs);

  // 期限判定
  const isExpired =
    (remainingMs <= 0 &&
      (mode === "absolute" || ((mode === "per_access" || mode === "step_delivery") && !preview))) ||
    serverSyncExpired;

  // 終了日時テキスト
  const endDateText = useMemo(() => {
    if (!showEndDate) return null;
    const d = new Date(targetTime);
    if (isNaN(d.getTime())) return null;
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${pad2(d.getHours())}時${pad2(d.getMinutes())}分まで`;
  }, [targetTime, showEndDate]);

  // ========= 各スタイル =========

  // 1) solid（従来の帯／角丸なし）
  if (styleVariant === "solid") {
    return (
      <div className={className}>
        <div className="rounded-none p-3" style={{ background: bgColor, color: textColor }}>
          <div className="text-xl font-semibold tracking-wide">
            {isExpired ? "期間終了" : internalTimer ? timerText : `残り${days}${dayLabel}${hours}${hourLabel}${minutes}${minuteLabel}${seconds}${secondLabel}`}
          </div>
          {showEndDate && endDateText && !isExpired && (
            <div className="text-sm mt-1 opacity-80">{endDateText}</div>
          )}
        </div>
      </div>
    );
  }

  // 2) glass = 画像①風（横長グレー帯＋黒文字）
  if (styleVariant === "glass") {
    return (
      <div className={className}>
        <div
          className="rounded-none px-4 py-2 flex items-center gap-2 text-lg font-bold"
          style={{ background: "#e5e7eb", color: "#111827" }}
        >
          {isExpired ? (
            "終了しました"
          ) : internalTimer ? (
            timerText
          ) : (
            <>
              終了まで
              <span className="text-xl">{days}</span>{dayLabel}
              <span className="text-xl">{pad2(hours)}</span>{hourLabel}
              <span className="text-xl">{pad2(minutes)}</span>{minuteLabel}
              <span className="text-xl">{pad2(seconds)}</span>{secondLabel}
            </>
          )}
        </div>
        {showEndDate && endDateText && !isExpired && (
          <div className="text-sm mt-1 opacity-70">{endDateText}</div>
        )}
      </div>
    );
  }

  // 3) outline = 画像②風（円形プログレス4つ）
  if (styleVariant === "outline") {
    // 円周 ≒ 2πr （r=36）
    const C = 2 * Math.PI * 36; // ≒ 226
    // 簡易上限（days は最大30想定）
    const unitMax = { days: 30, hours: 24, minutes: 60, seconds: 60 } as const;
    const parts = [
      { key: "days", label: "days", value: Math.min(days, 99), max: unitMax.days },
      { key: "hours", label: "hours", value: hours, max: unitMax.hours },
      { key: "minutes", label: "minutes", value: minutes, max: unitMax.minutes },
      { key: "seconds", label: "seconds", value: seconds, max: unitMax.seconds },
    ] as const;

    return (
      <div className={className}>
        <div className="flex gap-6">
          {parts.map((p, i) => {
            const frac = Math.max(0, Math.min(1, p.value / p.max));
            const dash = C * frac;
            return (
              <div key={i} className="relative w-20 h-20">
                <svg className="absolute inset-0 w-full h-full">
                  <circle cx="40" cy="40" r="36" stroke="#4b5563" strokeWidth="4" fill="none" />
                  {!isExpired && (
                    <circle
                      cx="40"
                      cy="40"
                      r="36"
                      stroke="#fb923c"
                      strokeWidth="4"
                      fill="none"
                      strokeDasharray={`${dash} ${C - dash}`}
                      transform="rotate(-90 40 40)"
                      strokeLinecap="round"
                    />
                  )}
                </svg>
                <div className="flex flex-col items-center justify-center h-full text-white">
                  <span className="text-xl font-bold">
                    {pad2(p.value)}
                  </span>
                  <span className="text-xs opacity-80">{p.label}</span>
                </div>
              </div>
            );
          })}
        </div>
        {showEndDate && endDateText && !isExpired && (
          <div className="text-sm mt-2 opacity-80 text-white">{endDateText}</div>
        )}
      </div>
    );
  }

  // 4) minimal = 画像③風（大きい数字＋単位を下に）
  return (
    <div className={className}>
      <div className="flex gap-8">
        {isExpired ? (
          <div className="text-xl">期間終了</div>
        ) : internalTimer ? (
          <div className="text-xl">{timerText}</div>
        ) : (
          <>
            <div className="flex flex-col items-center">
              <span className="text-5xl font-light">{pad2(days)}</span>
              <span className="text-sm opacity-80">{dayLabel}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-5xl font-light">{pad2(hours)}</span>
              <span className="text-sm opacity-80">{hourLabel}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-5xl font-light">{pad2(minutes)}</span>
              <span className="text-sm opacity-80">{minuteLabel}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-5xl font-light">{pad2(seconds)}</span>
              <span className="text-sm opacity-80">{secondLabel}</span>
            </div>
          </>
        )}
      </div>
      {showEndDate && endDateText && !isExpired && (
        <div className="text-sm mt-2 opacity-80">{endDateText}</div>
      )}
    </div>
  );
};

export default TimerPreview;

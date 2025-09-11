// src/components/TimerPreview.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TimerMode = "absolute" | "per_access" | "step_delivery";
// 画像③のために minimal を追加
export type TimerStyle = "solid" | "glass" | "outline" | "minimal";

interface TimerPreviewProps {
  mode: TimerMode;
  deadline?: string | null;
  durationSeconds?: number | null;
  showMilliseconds?: boolean;
  styleVariant?: TimerStyle;
  bgColor?: string;
  textColor?: string;
  shareCode?: string;
  uid?: string;
  className?: string;
  dayLabel?: string;
  hourLabel?: string;
  minuteLabel?: string;
  secondLabel?: string;
  preview?: boolean;
  internalTimer?: boolean;
  timerText?: string;
  showEndDate?: boolean;
  scenarioId?: string;
  stepId?: string;
}

function partsFromMs(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const milli = Math.max(0, ms % 1000);
  return { days, hours, minutes, seconds, milli };
}

function formatInline(
  ms: number,
  withMs: boolean,
  labels: { dayLabel: string; hourLabel: string; minuteLabel: string; secondLabel: string }
) {
  const { days, hours, minutes, seconds, milli } = partsFromMs(ms);
  let timeStr = "";
  if (days > 0) timeStr += `${days}${labels.dayLabel}`;
  if (hours > 0 || days > 0) timeStr += `${hours}${labels.hourLabel}`;
  if (minutes > 0 || hours > 0 || days > 0) timeStr += `${minutes}${labels.minuteLabel}`;
  timeStr += `${seconds}${labels.secondLabel}`;
  const base = `残り${timeStr}`;
  if (!withMs) return base;
  return `${base}${Math.floor(milli / 10).toString().padStart(2, "0")}`; // 2桁（センチ秒）表示
}

const hexToRgb = (hex?: string) => {
  if (!hex) return null;
  const m = hex.replace("#", "");
  const v = m.length === 3
    ? m.split("").map((c) => c + c).join("")
    : m.length === 6
      ? m
      : null;
  if (!v) return null;
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return { r, g, b };
};
const rgba = (hex?: string, a: number = 1) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex || `rgba(0,0,0,${a})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
};

export const TimerPreview = ({
  mode,
  deadline,
  durationSeconds,
  showMilliseconds = false,
  styleVariant = "solid",
  bgColor = "#0cb386",
  textColor = "#111111",
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
    const fetchTimerInfo = async () => {
      if (shareCode && (mode === "per_access" || mode === "step_delivery") && !preview) {
        try {
          const { data, error } = await supabase.functions.invoke("get-timer-info", {
            body: { pageShareCode: shareCode, uid },
          });
          if (error) return;
          if (data?.success && data?.timer_start_at) {
            setServerSyncedStart(new Date(data.timer_start_at));
            setServerSyncExpired(!!data.expired);
          }
        } catch {}
      }
    };
    fetchTimerInfo();
  }, [shareCode, uid, mode, preview]);

  // ゴール時刻（締切）を算出
  const targetTime = useMemo(() => {
    if (mode === "absolute" && deadline) {
      const t = new Date(deadline).getTime();
      return isNaN(t) ? Date.now() : t;
    }
    if ((mode === "per_access" || mode === "step_delivery") && durationSeconds && durationSeconds > 0) {
      if (preview) return Date.now() + durationSeconds * 1000;
      if (serverSyncedStart) return serverSyncedStart.getTime() + durationSeconds * 1000;

      // localStorage フォールバック
      const key =
        mode === "step_delivery" && scenarioId && stepId && uid && shareCode
          ? `step_delivery_timer:${shareCode}:${uid}:${scenarioId}:${stepId}`
          : `cms_page_first_access:${shareCode || "preview"}:${uid || "anon"}`;

      try {
        const stored = localStorage.getItem(key);
        const start = stored ? Number(stored) : Date.now();
        if (!stored || isNaN(start)) localStorage.setItem(key, String(start));
        return start + durationSeconds * 1000;
      } catch {
        return Date.now() + durationSeconds * 1000;
      }
    }
    return Date.now();
  }, [mode, deadline, durationSeconds, shareCode, uid, preview, scenarioId, stepId, serverSyncedStart]);

  // 残り時間の更新ループ
  useEffect(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    const tick = () => setRemainingMs(Math.max(0, targetTime - Date.now()));
    tick();
    const intervalMs = showMilliseconds ? 50 : 500;
    intervalRef.current = window.setInterval(tick, intervalMs);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [targetTime, showMilliseconds]);

  const isExpired =
    (remainingMs <= 0 &&
      (mode === "absolute" || ((mode === "per_access" || mode === "step_delivery") && !preview))) ||
    serverSyncExpired;

  const endDateText = useMemo(() => {
    if (!showEndDate) return null;
    const endDate = new Date(targetTime);
    if (isNaN(endDate.getTime())) return null;
    const y = endDate.getFullYear();
    const m = endDate.getMonth() + 1;
    const d = endDate.getDate();
    const h = endDate.getHours().toString();
    const min = endDate.getMinutes().toString().padStart(2, "0");
    return `${y}年${m}月${d}日 ${h}時${min}分まで`;
  }, [targetTime, showEndDate]);

  // --------------- スタイルごとの描画 ----------------

  // 画像①：横長ラベル（glass）
  const LabelBar = () => {
    const { days, hours, minutes, seconds, milli } = partsFromMs(remainingMs);
    const cs = Math.floor(milli / 10).toString().padStart(2, "0"); // centiseconds
    if (internalTimer) {
      return (
        <div
          className="w-full rounded-md p-2 md:p-3 backdrop-blur"
          style={{ background: rgba(bgColor, 0.18), color: textColor, border: `1px solid ${rgba(textColor, 0.15)}` }}
        >
          <span className="font-semibold tracking-wide">{timerText}</span>
        </div>
      );
    }
    return (
      <div
        className="w-full rounded-md p-2 md:p-3 backdrop-blur flex items-baseline gap-2 md:gap-3 flex-wrap"
        style={{ background: rgba(bgColor, 0.18), color: textColor, border: `1px solid ${rgba(textColor, 0.15)}` }}
      >
        <span className="text-sm md:text-base opacity-80">終了まで</span>
        <span className="text-lg md:text-2xl font-extrabold tabular-nums">{days}</span>
        <span className="text-sm md:text-base opacity-80">{dayLabel}</span>
        <span className="text-lg md:text-2xl font-extrabold tabular-nums">{hours.toString().padStart(2, "0")}</span>
        <span className="text-sm md:text-base opacity-80">{hourLabel}</span>
        <span className="text-lg md:text-2xl font-extrabold tabular-nums">{minutes.toString().padStart(2, "0")}</span>
        <span className="text-sm md:text-base opacity-80">{minuteLabel}</span>
        <span className="text-lg md:text-2xl font-extrabold tabular-nums">{seconds.toString().padStart(2, "0")}</span>
        <span className="text-sm md:text-base opacity-80">{secondLabel}</span>
        {showMilliseconds && <span className="text-lg md:text-2xl font-extrabold tabular-nums">{cs}</span>}
      </div>
    );
  };

  // 画像②：円リング（outline）
  const Ring = ({
    value,
    max,
    label,
  }: {
    value: number;
    max: number;
    label: string;
  }) => {
    const r = 36;
    const c = 2 * Math.PI * r;
    const pct = Math.max(0, Math.min(1, value / max));
    const offset = c * (1 - pct);
    return (
      <div className="flex flex-col items-center justify-center">
        <svg width="96" height="96" viewBox="0 0 96 96" className="block">
          <g transform="rotate(-90 48 48)">
            {/* track */}
            <circle cx="48" cy="48" r={r} stroke={rgba(textColor, 0.15)} strokeWidth="8" fill="none" />
            {/* progress */}
            <circle
              cx="48"
              cy="48"
              r={r}
              stroke={bgColor}
              strokeWidth="8"
              strokeLinecap="round"
              fill="none"
              strokeDasharray={c}
              strokeDashoffset={offset}
            />
          </g>
        </svg>
        <div className="mt-[-72px] text-center select-none pointer-events-none">
          <div className="text-2xl font-extrabold tabular-nums" style={{ color: textColor }}>
            {value.toString().padStart(2, "0")}
          </div>
          <div className="text-xs opacity-70" style={{ color: textColor }}>
            {label}
          </div>
        </div>
      </div>
    );
  };

  const RingGrid = () => {
    const { days, hours, minutes, seconds } = partsFromMs(remainingMs);
    if (internalTimer) {
      return (
        <div className="rounded-md p-3 text-center" style={{ color: textColor, background: rgba(bgColor, 0.08) }}>
          <span className="font-semibold">{timerText}</span>
        </div>
      );
    }
    // 正規化（リングの進捗）：daysは最大30日で丸め
    const dayMax = Math.max(1, Math.min(30, days || 1));
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-center justify-items-center">
        <Ring value={Math.min(days, 99)} max={dayMax} label="days" />
        <Ring value={hours} max={24} label="hours" />
        <Ring value={minutes} max={60} label="minutes" />
        <Ring value={seconds} max={60} label="seconds" />
      </div>
    );
  };

  // 画像③：ミニマル（minimal）
  const Minimal = () => {
    const { days, hours, minutes, seconds } = partsFromMs(remainingMs);
    if (internalTimer) {
      return (
        <div className="text-center">
          <div className="text-2xl md:text-3xl font-semibold" style={{ color: textColor }}>
            {timerText}
          </div>
        </div>
      );
    }
    return (
      <div className="w-full">
        <div
          className="flex items-end justify-between sm:justify-around gap-4 sm:gap-8"
          style={{ color: textColor }}
        >
          <div className="text-center">
            <div className="font-mono tabular-nums text-5xl sm:text-7xl font-light">{days}</div>
            <div className="text-xs sm:text-sm opacity-70 mt-1">{dayLabel}</div>
          </div>
          <div className="text-center">
            <div className="font-mono tabular-nums text-5xl sm:text-7xl font-light">
              {hours.toString().padStart(2, "0")}
            </div>
            <div className="text-xs sm:text-sm opacity-70 mt-1">{hourLabel}</div>
          </div>
          <div className="text-center">
            <div className="font-mono tabular-nums text-5xl sm:text-7xl font-light">
              {minutes.toString().padStart(2, "0")}
            </div>
            <div className="text-xs sm:text-sm opacity-70 mt-1">{minuteLabel}</div>
          </div>
          <div className="text-center">
            <div className="font-mono tabular-nums text-5xl sm:text-7xl font-light">
              {seconds.toString().padStart(2, "0")}
            </div>
            <div className="text-xs sm:text-sm opacity-70 mt-1">{secondLabel}</div>
          </div>
        </div>
      </div>
    );
  };

  // 既存：solid（角丸0・バー1本）
  const Solid = () => {
    const text = formatInline(remainingMs, showMilliseconds, {
      dayLabel,
      hourLabel,
      minuteLabel,
      secondLabel,
    });
    return (
      <div
        className="rounded-none p-3"
        style={{ background: bgColor, color: textColor }}
      >
        <div className="text-xl font-semibold tracking-wide">{internalTimer ? timerText : text}</div>
      </div>
    );
  };

  // --------------- 出力 ---------------
  if (isExpired) {
    return (
      <div className={className}>
        <div
          className={styleVariant === "solid" ? "rounded-none p-3" : "rounded-md p-3"}
          style={{
            background: styleVariant === "solid" ? bgColor : rgba(bgColor, 0.12),
            color: textColor,
            border: styleVariant === "solid" ? undefined : `1px solid ${rgba(textColor, 0.12)}`,
          }}
        >
          <div className="text-xl font-semibold tracking-wide">期間終了</div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {styleVariant === "solid" && <Solid />}
      {styleVariant === "glass" && <LabelBar />}
      {styleVariant === "outline" && <RingGrid />}
      {styleVariant === "minimal" && <Minimal />}

      {showEndDate && endDateText && (
        <div className="text-sm mt-2 text-center" style={{ color: rgba(textColor, 0.8) }}>
          {endDateText}
        </div>
      )}
    </div>
  );
};

export default TimerPreview;

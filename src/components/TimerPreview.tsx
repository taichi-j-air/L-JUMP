import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TimerMode = "absolute" | "per_access" | "step_delivery";
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
  showRemainingText?: boolean;
  scenarioId?: string;
  stepId?: string;
  onExpire?: () => void;
}


function splitParts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const milli = Math.max(0, ms % 1000);
  return { days, hours, minutes, seconds, milli };
}

function hexToRgb(hex: string) {
  const m = hex.replace("#", "").match(/^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return { r: 12, g: 179, b: 134 };
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}
function mixToLighter(hex: string, ratio = 0.35) {
  const { r, g, b } = hexToRgb(hex);
  const rr = Math.round(r + (255 - r) * ratio);
  const gg = Math.round(g + (255 - g) * ratio);
  const bb = Math.round(b + (255 - b) * ratio);
  return `rgb(${rr}, ${gg}, ${bb})`;
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
  showRemainingText = true,
  scenarioId,
  stepId,
  onExpire,
}: TimerPreviewProps) => {
  const [remainingMs, setRemainingMs] = useState<number>(0);
  const [serverSyncedStart, setServerSyncedStart] = useState<Date | null>(null);
  const [serverSyncExpired, setServerSyncExpired] = useState<boolean>(false);
  const intervalRef = useRef<number | null>(null);
  const expireNotifiedRef = useRef(false);
  const initializedRef = useRef(false);

  // サーバー同期
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
            setServerSyncExpired(Boolean(data.expired));
          }
        } catch {}
      }
    };
    fetchTimerInfo();
  }, [shareCode, uid, mode, preview]);

  const targetTime = useMemo(() => {
    if (mode === "absolute" && deadline) {
      const t = new Date(deadline).getTime();
      return isNaN(t) ? Date.now() : t;
    }
    if ((mode === "per_access" || mode === "step_delivery") && durationSeconds && durationSeconds > 0) {
      if (preview) return Date.now() + durationSeconds * 1000;
      if (serverSyncedStart) return serverSyncedStart.getTime() + durationSeconds * 1000;

      if (mode === "step_delivery" && scenarioId && stepId && uid && shareCode) {
        const key = `step_delivery_timer:${shareCode}:${uid}:${scenarioId}:${stepId}`;
        try {
          const stored = localStorage.getItem(key);
          if (stored) {
            const startTime = Number(stored);
            if (!isNaN(startTime)) return startTime + durationSeconds * 1000;
          }
          const now = Date.now();
          localStorage.setItem(key, String(now));
          return now + durationSeconds * 1000;
        } catch {
          return Date.now() + durationSeconds * 1000;
        }
      } else {
        const key = `cms_page_first_access:${shareCode || "preview"}:${uid || "anon"}`;
        try {
          const stored = localStorage.getItem(key);
          let start = stored ? Number(stored) : Date.now();
          if (isNaN(start)) start = Date.now();
          if (!stored || isNaN(Number(stored))) localStorage.setItem(key, String(start));
          return start + durationSeconds * 1000;
        } catch {
          return Date.now() + durationSeconds * 1000;
        }
      }
    }
    return Date.now();
  }, [mode, deadline, durationSeconds, shareCode, uid, preview, scenarioId, stepId, serverSyncedStart]);

  useEffect(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    initializedRef.current = false;
    const tick = () => {
      const ms = Math.max(0, targetTime - Date.now());
      setRemainingMs(ms);
      if (!initializedRef.current) {
        initializedRef.current = true;
      }
    };
    tick();
    intervalRef.current = window.setInterval(tick, showMilliseconds ? 50 : 500);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [targetTime, showMilliseconds]);

  const { days, hours, minutes, seconds, milli } = splitParts(remainingMs);
  const isExpired = useMemo(() => {
    // プレビューモードでは期限切れ判定を無効化
    if (preview) return false;
    
    // サーバー同期が明示的に期限切れを示している場合
    if (serverSyncExpired) return true;
    
    // タイマーモード別の期限切れ判定
    if (mode === "absolute") {
      return remainingMs <= 0;
    }
    
    if (mode === "per_access" || mode === "step_delivery") {
      // サーバー同期情報がある場合はそれを優先
      if (serverSyncedStart !== null) {
        return serverSyncExpired;
      }
      // サーバー同期情報がない場合は期限切れではない
      return false;
    }
    
    return remainingMs <= 0;
  }, [remainingMs, mode, preview, serverSyncExpired, serverSyncedStart]);

  useEffect(() => {
    if (!onExpire) {
      expireNotifiedRef.current = false;
      return;
    }
    if (!initializedRef.current) {
      return;
    }
    if (isExpired && !expireNotifiedRef.current) {
      expireNotifiedRef.current = true;
      onExpire();
    } else if (!isExpired) {
      expireNotifiedRef.current = false;
    }
  }, [isExpired, onExpire]);

  const endDateText = useMemo(() => {
    const d = new Date(targetTime);
    if (isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const dd = d.getDate();
    const hh = d.getHours();
    const mm = d.getMinutes().toString().padStart(2, "0");
    return `${y}年${m}月${dd}日 ${hh}時${mm}分まで`;
  }, [targetTime]);

  /* ==================== スタイル別ビュー ==================== */

  // 画像①: ガラス風（数字大・ミリ秒対応・色は濃く）
  const GlassInlineView = () => (
    <div className="p-3">
      <div className="flex items-baseline gap-2 flex-wrap" style={{ color: textColor }}>
        <span className="text-sm">終了まで</span>
        <span className="text-2xl font-extrabold">{days}</span>
        <span className="text-sm font-medium">{dayLabel}</span>
        <span className="text-2xl font-extrabold">{String(hours).padStart(2, "0")}</span>
        <span className="text-sm font-medium">{hourLabel}</span>
        <span className="text-2xl font-extrabold">{String(minutes).padStart(2, "0")}</span>
        <span className="text-sm font-medium">{minuteLabel}</span>
        <span className="text-2xl font-extrabold">{String(seconds).padStart(2, "0")}</span>
        <span className="text-sm font-medium">{secondLabel}</span>
        {showMilliseconds && (
          <span className="text-base font-bold ml-1">{String(milli).padStart(3, "0")}</span>
        )}
      </div>
    </div>
  );

  // 画像②: 円リング（背景は透明／リング色のみ bgColor を反映）
  const OutlineView = () => {
    const accent = mixToLighter(bgColor, 0.35);
    const track = mixToLighter(bgColor, 0.85);

    const Circle = ({ value, max, label }: { value: number; max: number; label: string }) => {
      const r = 28;
      const c = 2 * Math.PI * r;
      const pct = Math.max(0, Math.min(1, value / max));
      const dash = c * pct;
      return (
        <div className="flex flex-col items-center justify-center w-16 h-20 sm:w-20 sm:h-24">
          <svg width="64" height="64" viewBox="0 0 72 72" className="block">
            <circle cx="36" cy="36" r={r} stroke={track} strokeWidth="8" fill="none" strokeLinecap="round" />
            <circle
              cx="36"
              cy="36"
              r={r}
              stroke={accent}
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              transform="rotate(-90 36 36)"
              strokeDasharray={`${dash} ${c}`}
            />
            <text
              x="50%"
              y="50%"
              dominantBaseline="middle"
              textAnchor="middle"
              fontSize="18"
              fontWeight={800}
              style={{ fill: textColor }}
            >
              {String(value).padStart(2, "0")}
            </text>
          </svg>
          <div className="text-xs mt-1" style={{ color: textColor }}>
            {label}
          </div>
        </div>
      );
    };

    return (
      <div className="pt-3 px-4">
        {showRemainingText && (
          <div className="mb-2 text-sm font-medium text-center" style={{ color: textColor }}>
            終了まで残り
          </div>
        )}
        <div
          className="flex items-center justify-between gap-3 flex-nowrap overflow-x-auto whitespace-nowrap"
          style={{ color: textColor }}
        >
          <Circle value={days % 365} max={365} label={dayLabel} />
          <Circle value={hours} max={24} label={hourLabel} />
          <Circle value={minutes} max={60} label={minuteLabel} />
          <Circle value={seconds} max={60} label={secondLabel} />
        </div>
      </div>
    );
  };

  // 画像③: ミニマル（背景透明・中央見出し・左右余白）
  const MinimalView = () => {
    const Cell = ({ v, l }: { v: number; l: string }) => (
      <div className="flex flex-col items-center justify-center min-w-[64px]">
        <div className="text-4xl sm:text-5xl font-semibold leading-none" style={{ color: textColor }}>
          {String(v).padStart(2, "0")}
        </div>
        <div className="text-xs mt-1" style={{ color: textColor }}>
          {l}
        </div>
      </div>
    );
    return (
      <div className="pt-3 px-4">
        {showRemainingText && (
          <div className="mb-2 text-sm font-medium text-center" style={{ color: textColor }}>
            終了まで残り
          </div>
        )}
        <div className="flex items-end justify-between gap-4 flex-nowrap overflow-x-auto whitespace-nowrap">
          <Cell v={days} l={dayLabel} />
          <Cell v={hours} l={hourLabel} />
          <Cell v={minutes} l={minuteLabel} />
          <Cell v={seconds} l={secondLabel} />
        </div>
      </div>
    );
  };

  // コンテナ装飾（角丸0は維持）
  const containerClass = {
    solid: "rounded-none p-3",
    glass: "rounded-none p-0",   // ← 外枠なし
    outline: "rounded-none p-0", // ← 外枠なし
    minimal: "rounded-none p-0",
  } as const;

  // 背景色：glass も不透明（薄くならない）
  const containerStyle: React.CSSProperties =
    styleVariant === "solid"
      ? { background: bgColor, color: textColor }
      : styleVariant === "glass"
      ? { background: bgColor, color: textColor } // ← 透過をやめる
      : { background: "transparent", color: textColor };

  return (
    <div className={className}>
      <div className={`${containerClass[styleVariant]}`} style={containerStyle}>
        {isExpired ? (
          <div className="text-xl font-semibold tracking-wide p-3" style={{ color: textColor }}>
            期間終了
          </div>
        ) : internalTimer ? (
          <div className="text-xl font-semibold tracking-wide p-3" style={{ color: textColor }}>
            {timerText}
          </div>
        ) : (
          <>
            {styleVariant === "solid" && (
              <div className="text-xl font-semibold tracking-wide" style={{ color: textColor }}>
                残り
                {days > 0 && `${days}${dayLabel}`}
                {(hours > 0 || days > 0) && `${hours}${hourLabel}`}
                {(minutes > 0 || hours > 0 || days > 0) && `${minutes}${minuteLabel}`}
                {`${seconds}${secondLabel}`}
                {showMilliseconds && String(milli).padStart(3, "0")}
              </div>
            )}
            {styleVariant === "glass" && <GlassInlineView />}
            {styleVariant === "outline" && <OutlineView />}
            {styleVariant === "minimal" && <MinimalView />}
          </>
        )}

        {!isExpired && showEndDate && endDateText && (
          <div className="text-sm mt-2 opacity-80 px-3 pb-3" style={{ color: textColor }}>
            {endDateText}
          </div>
        )}
      </div>
    </div>
  );
};

export default TimerPreview;

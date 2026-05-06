"use client";

import { useEffect, useRef, useState } from "react";

import { learnerApiFetch } from "../../../../lib/learner-api";

type StatsLabels = {
  couldNotLoad: string;
  heading: string;
  loading: string;
  matchesLine: string;
  wldrLine: string;
  winRateLine: string;
};

type CompactStats = {
  completedMatches: number;
  draws: number;
  losses: number;
  winRatePct: number;
  wins: number;
};

type UserPresencePopoverProps = {
  displayName: string;
  isSelf: boolean;
  labels: {
    challenge: string;
    lobbyOnline: string;
    member: string;
    userLabel: string;
  };
  onChallenge: () => void;
  onClose: () => void;
  onHoverGroupEnter?: () => void;
  onHoverGroupLeave?: () => void;
  statsLabels: StatsLabels;
  targetUserId: string;
  triggerRect: DOMRect;
};

export function UserPresencePopover({
  displayName,
  isSelf,
  labels,
  onChallenge,
  onClose,
  onHoverGroupEnter,
  onHoverGroupLeave,
  statsLabels,
  targetUserId,
  triggerRect
}: UserPresencePopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const [visible, setVisible] = useState(false);
  const [stats, setStats] = useState<CompactStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStatsLoading(true);
    setStatsError(false);
    void (async () => {
      try {
        const r = await learnerApiFetch(
          `/api/battle/player-stats?userId=${encodeURIComponent(targetUserId)}`
        );
        if (!r.ok) throw new Error("bad");
        const j = (await r.json()) as CompactStats;
        if (!cancelled) setStats(j);
      } catch {
        if (!cancelled) {
          setStats(null);
          setStatsError(true);
        }
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [targetUserId]);

  useEffect(() => {
    const popoverWidth = 300;
    const gap = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = triggerRect.top + triggerRect.height / 2 - 72;
    let left = triggerRect.left - popoverWidth - gap;

    if (left < 8) {
      left = triggerRect.right + gap;
    }

    if (left + popoverWidth > vw - 8) {
      left = Math.max(8, triggerRect.left + triggerRect.width / 2 - popoverWidth / 2);
      top = triggerRect.bottom + gap;
    }

    top = Math.max(8, Math.min(top, vh - 260));
    left = Math.max(8, Math.min(left, vw - popoverWidth - 8));

    setPosition({ left, top });
    requestAnimationFrame(() => setVisible(true));
  }, [triggerRect]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  return (
    <div
      className={`fixed z-50 w-[min(300px,calc(100vw-1rem))] rounded-2xl border border-leaf/25 bg-surface p-4 shadow-xl transition-all duration-150 ${
        visible ? "scale-100 opacity-100" : "scale-95 opacity-0"
      }`}
      onMouseEnter={onHoverGroupEnter}
      onMouseLeave={onHoverGroupLeave}
      ref={ref}
      role="dialog"
      aria-label={displayName}
      style={{ left: position.left, top: position.top }}
    >
      <p className="text-[11px] font-black uppercase tracking-wide text-leaf">{labels.member}</p>
      <p className="mt-1 truncate text-sm font-bold text-ink">{displayName}</p>
      <p className="mt-1 text-xs font-semibold text-muted">
        {isSelf ? labels.userLabel : labels.lobbyOnline}
      </p>

      <div className="mt-3 rounded-xl border border-ink/10 bg-paper/90 p-3">
        <p className="text-[10px] font-black uppercase tracking-wide text-muted">
          {statsLabels.heading}
        </p>
        {statsLoading ? (
          <p className="mt-2 text-xs font-semibold text-muted">{statsLabels.loading}</p>
        ) : statsError || !stats ? (
          <p className="mt-2 text-xs font-semibold text-amber-900">{statsLabels.couldNotLoad}</p>
        ) : (
          <>
            <p className="mt-2 text-xs font-bold text-ink">
              {statsLabels.wldrLine
                .replace("{wins}", String(stats.wins))
                .replace("{losses}", String(stats.losses))
                .replace("{draws}", String(stats.draws))}
            </p>
            <p className="mt-1 text-xs font-semibold text-muted">
              {statsLabels.matchesLine.replace("{n}", String(stats.completedMatches))}
            </p>
            <p className="mt-1 text-xs font-bold text-leaf">
              {statsLabels.winRateLine.replace("{pct}", String(stats.winRatePct))}
            </p>
          </>
        )}
      </div>

      {!isSelf ? (
        <button
          className="mt-3 w-full rounded-xl bg-ink py-2 text-sm font-bold text-surface hover:bg-ink/90"
          onClick={() => {
            onChallenge();
            onClose();
          }}
          type="button"
        >
          {labels.challenge}
        </button>
      ) : null}
    </div>
  );
}

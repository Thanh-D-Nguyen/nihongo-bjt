"use client";

import { useEffect, useMemo, useState } from "react";

import { apiBase, type BattlePageLabels } from "./battle-types";

export type BattleConfigItem = {
  id: string;
  name: string;
  description: string | null;
  level: string;
  questionCount: number;
  timePerQuestionSec: number;
  maxParticipants: number;
  botDifficulties: string[];
  scoringRules: Record<string, unknown> | null;
  scheduleStart: string | null;
  scheduleEnd: string | null;
  publishedAt: string | null;
  isUpcoming: boolean;
  isActive: boolean;
};

type Props = {
  accessToken: string | null;
  labels: BattlePageLabels;
  locale: string;
  onSelectConfig: (config: BattleConfigItem) => void;
  selectedConfigId: string | null;
};

function formatCountdown(targetDate: Date): string {
  const now = Date.now();
  const diff = targetDate.getTime() - now;
  if (diff <= 0) return "Now";
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function levelBadgeColor(level: string): string {
  if (level.includes("N1") || level.includes("advanced")) return "border-red-200 bg-red-50 text-red-700";
  if (level.includes("N2")) return "border-orange-200 bg-orange-50 text-orange-700";
  if (level.includes("N3") || level.includes("intermediate")) return "border-amber-200 bg-amber-50 text-amber-700";
  if (level.includes("N4")) return "border-green-200 bg-green-50 text-green-700";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

export function BattleConfigsPanel({ accessToken, labels, locale, onSelectConfig, selectedConfigId }: Props) {
  const [configs, setConfigs] = useState<BattleConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [countdownTick, setCountdownTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!accessToken) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${apiBase}/api/battle/configs/available`, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (!res.ok) return;
        const data = (await res.json()) as BattleConfigItem[];
        if (!cancelled) setConfigs(data);
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [accessToken]);

  // Tick countdown every 30s for upcoming battles
  useEffect(() => {
    const hasUpcoming = configs.some((c) => c.isUpcoming);
    if (!hasUpcoming) return;
    const interval = setInterval(() => setCountdownTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, [configs]);

  const { active, upcoming } = useMemo(() => {
    const a: BattleConfigItem[] = [];
    const u: BattleConfigItem[] = [];
    for (const c of configs) {
      if (c.isUpcoming) u.push(c);
      else if (c.isActive) a.push(c);
    }
    return { active: a, upcoming: u };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configs, countdownTick]);

  if (loading) {
    return (
      <div className="space-y-2" aria-busy="true">
        {[0, 1].map((i) => (
          <div className="battle-skeleton h-20 rounded-xl" key={i} />
        ))}
      </div>
    );
  }

  if (configs.length === 0) return null;

  return (
    <div className="space-y-3">
      {active.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-wider text-muted">
            ⚔️ Available Battles
          </p>
          {active.map((config) => (
            <ConfigCard
              config={config}
              key={config.id}
              onSelect={onSelectConfig}
              selected={selectedConfigId === config.id}
            />
          ))}
        </div>
      )}
      {upcoming.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-wider text-muted">
            🕐 Upcoming
          </p>
          {upcoming.map((config) => (
            <ConfigCard
              config={config}
              isUpcoming
              key={config.id}
              onSelect={onSelectConfig}
              selected={selectedConfigId === config.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ConfigCard({
  config,
  isUpcoming,
  onSelect,
  selected
}: {
  config: BattleConfigItem;
  isUpcoming?: boolean;
  onSelect: (c: BattleConfigItem) => void;
  selected: boolean;
}) {
  const levelCls = levelBadgeColor(config.level);
  const countdown = isUpcoming && config.scheduleStart
    ? formatCountdown(new Date(config.scheduleStart))
    : null;

  const scoringDesc = useMemo(() => {
    if (!config.scoringRules) return null;
    const rules = config.scoringRules;
    const parts: string[] = [];
    if (typeof rules.correctPoints === "number") parts.push(`+${rules.correctPoints}pt correct`);
    if (typeof rules.wrongPenalty === "number" && rules.wrongPenalty > 0) parts.push(`-${rules.wrongPenalty}pt wrong`);
    if (typeof rules.speedBonus === "number" && rules.speedBonus > 0) parts.push(`speed bonus`);
    if (typeof rules.comboMultiplier === "number" && rules.comboMultiplier > 1) parts.push(`combo ×${rules.comboMultiplier}`);
    return parts.length > 0 ? parts.join(" · ") : null;
  }, [config.scoringRules]);

  return (
    <button
      className={`w-full rounded-xl border p-3 text-left transition ${
        selected
          ? "border-accent/30 bg-accent/5 shadow-sm shadow-accent/10 ring-1 ring-accent/20"
          : isUpcoming
            ? "border-ink/10 bg-paper/60 opacity-80 hover:opacity-100"
            : "border-ink/10 bg-white hover:border-accent/20 hover:bg-accent/[0.02] hover:shadow-sm"
      }`}
      disabled={isUpcoming}
      onClick={() => onSelect(config)}
      type="button"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink">{config.name}</p>
          {config.description && (
            <p className="mt-0.5 line-clamp-1 text-[11px] font-semibold text-muted">
              {config.description}
            </p>
          )}
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black ${levelCls}`}>
          {config.level}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-bold text-muted">
        <span className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2 py-0.5">
          📝 {config.questionCount}Q
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2 py-0.5">
          ⏱️ {config.timePerQuestionSec}s
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2 py-0.5">
          👥 {config.maxParticipants}P
        </span>
        {countdown && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700">
            🕐 {countdown}
          </span>
        )}
      </div>
      {scoringDesc && (
        <p className="mt-1.5 text-[10px] font-semibold text-accent/80">
          {scoringDesc}
        </p>
      )}
    </button>
  );
}

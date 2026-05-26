"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { apiBase, type BattlePageLabels } from "./battle-types";

export type BattleConfigItem = {
  id: string;
  name: string;
  description: string | null;
  level: string;
  gameType: string;
  questionPoolKey: string;
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

type GameTypeMeta = { icon: string; label: string; color: string; bgGradient: string };

const GAME_TYPE_META: Record<string, GameTypeMeta> = {
  speed_duel: { icon: "⚡", label: "Speed", color: "text-amber-700", bgGradient: "from-amber-50 to-orange-50/60" },
  kanji_vocab_duel: { icon: "漢", label: "Kanji", color: "text-indigo-700", bgGradient: "from-indigo-50 to-violet-50/60" },
  listening_challenge: { icon: "🎧", label: "Listening", color: "text-cyan-700", bgGradient: "from-cyan-50 to-sky-50/60" },
  business_roleplay: { icon: "💼", label: "Business", color: "text-emerald-700", bgGradient: "from-emerald-50 to-teal-50/60" },
  boss_rush: { icon: "🔥", label: "Boss Rush", color: "text-red-700", bgGradient: "from-red-50 to-rose-50/60" },
  mock_exam_sprint: { icon: "📋", label: "Mock Exam", color: "text-violet-700", bgGradient: "from-violet-50 to-purple-50/60" },
  team_room: { icon: "👥", label: "Team", color: "text-blue-700", bgGradient: "from-blue-50 to-sky-50/60" },
  tournament: { icon: "🏆", label: "Tournament", color: "text-yellow-700", bgGradient: "from-yellow-50 to-amber-50/60" },
  custom: { icon: "⚙️", label: "Custom", color: "text-slate-700", bgGradient: "from-slate-50 to-gray-50/60" }
};

const POOL_LABELS: Record<string, string> = {
  bjt_questions_active: "BJT",
  jlpt_grammar_active: "Grammar",
  kanji_reading_active: "Kanji",
  vocab_high_freq: "Vocab",
  business_phrase_pack: "Business"
};

function getGameTypeMeta(gameType: string): GameTypeMeta {
  return GAME_TYPE_META[gameType] ?? GAME_TYPE_META.custom!;
}

export function BattleConfigsPanel({ accessToken, onSelectConfig, selectedConfigId }: Props) {
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
    void countdownTick;
    return { active: a, upcoming: u };
  }, [configs, countdownTick]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      ro.disconnect();
    };
  }, [active, upcoming, updateScrollState]);

  const scroll = useCallback((dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.7;
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  }, []);

  if (loading) {
    return (
      <div className="flex gap-3 overflow-hidden" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div className="battle-skeleton h-[5.5rem] w-64 shrink-0 rounded-xl" key={i} />
        ))}
      </div>
    );
  }

  if (configs.length === 0) return null;

  const allCards = [
    ...active.map((c) => ({ config: c, isUpcoming: false })),
    ...upcoming.map((c) => ({ config: c, isUpcoming: true }))
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-wider text-muted">
          ⚔️ Available Battles
          {allCards.length > 3 && (
            <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-ink/10 text-[9px] font-black text-ink">
              {allCards.length}
            </span>
          )}
        </p>
        {(canScrollLeft || canScrollRight) && (
          <div className="flex items-center gap-1">
            <button
              aria-label="Scroll left"
              className="grid h-7 w-7 place-items-center rounded-lg border border-ink/10 bg-white text-xs text-ink transition hover:bg-paper disabled:opacity-30"
              disabled={!canScrollLeft}
              onClick={() => scroll("left")}
              type="button"
            >
              ←
            </button>
            <button
              aria-label="Scroll right"
              className="grid h-7 w-7 place-items-center rounded-lg border border-ink/10 bg-white text-xs text-ink transition hover:bg-paper disabled:opacity-30"
              disabled={!canScrollRight}
              onClick={() => scroll("right")}
              type="button"
            >
              →
            </button>
          </div>
        )}
      </div>
      <div
        className="scrollbar-none -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2"
        ref={scrollRef}
      >
        {allCards.map(({ config, isUpcoming: up }) => (
          <ConfigCard
            config={config}
            isUpcoming={up}
            key={config.id}
            onSelect={onSelectConfig}
            selected={selectedConfigId === config.id}
          />
        ))}
      </div>
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
  const meta = getGameTypeMeta(config.gameType);
  const poolLabel = POOL_LABELS[config.questionPoolKey] ?? config.questionPoolKey;

  const scoringDesc = useMemo(() => {
    if (!config.scoringRules) return null;
    const rules = config.scoringRules;
    const parts: string[] = [];
    if (typeof rules.correctPoints === "number") parts.push(`+${rules.correctPoints}pt`);
    if (typeof rules.wrongPenalty === "number" && rules.wrongPenalty > 0) parts.push(`-${rules.wrongPenalty}pt`);
    if (typeof rules.speedBonus === "number" && rules.speedBonus > 0) parts.push(`speed`);
    if (typeof rules.comboMultiplier === "number" && rules.comboMultiplier > 1) parts.push(`×${rules.comboMultiplier}`);
    return parts.length > 0 ? parts.join(" · ") : null;
  }, [config.scoringRules]);

  // Duration estimate
  const totalSec = config.questionCount * config.timePerQuestionSec;
  const durationLabel = totalSec >= 60
    ? `~${Math.ceil(totalSec / 60)}min`
    : `~${totalSec}s`;

  // Intensity (0-4): higher = more competitive/punishing
  const intensity = useMemo(() => {
    let score = 0;
    const rules = config.scoringRules;
    if (rules) {
      if (typeof rules.wrongPenalty === "number" && rules.wrongPenalty > 0) score++;
      if (typeof rules.speedBonus === "number" && rules.speedBonus > 0) score++;
      if (typeof rules.comboMultiplier === "number" && rules.comboMultiplier > 1) score++;
    }
    if (config.timePerQuestionSec <= 10) score++;
    return Math.min(score, 4);
  }, [config.scoringRules, config.timePerQuestionSec]);

  return (
    <button
      className={`w-64 shrink-0 snap-start rounded-xl border p-3 text-left transition ${
        selected
          ? "border-accent/30 bg-accent/5 shadow-sm shadow-accent/10 ring-1 ring-accent/20"
          : isUpcoming
            ? "border-ink/10 bg-paper/60 opacity-80 hover:opacity-100"
            : `border-ink/10 bg-gradient-to-br ${meta.bgGradient} hover:border-accent/20 hover:shadow-sm`
      }`}
      disabled={isUpcoming}
      onClick={() => onSelect(config)}
      type="button"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/80 text-base shadow-sm ring-1 ring-ink/5" aria-hidden>
            {meta.icon}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-ink">{config.name}</p>
            <p className={`text-[10px] font-black ${meta.color}`}>{meta.label}</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black ${levelCls}`}>
          {config.level}
        </span>
      </div>
      {config.description && (
        <p className="mt-1.5 line-clamp-1 text-[11px] font-semibold text-muted">
          {config.description}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-muted">
        <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 ring-1 ring-ink/5">
          📝 {config.questionCount}Q
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 ring-1 ring-ink/5">
          ⏱️ {config.timePerQuestionSec}s
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 ring-1 ring-ink/5">
          � {durationLabel}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 ring-1 ring-ink/5">
          📚 {poolLabel}
        </span>
        {countdown && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700">
            🕐 {countdown}
          </span>
        )}
      </div>
      {/* Intensity bar */}
      <div className="mt-2 flex items-center gap-1.5">
        <span className="text-[9px] font-bold text-muted/70">Intensity</span>
        <div className="flex gap-0.5">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-1.5 w-3 rounded-full ${
                i < intensity
                  ? i >= 3 ? "bg-red-400" : i >= 2 ? "bg-orange-400" : "bg-amber-400"
                  : "bg-ink/10"
              }`}
            />
          ))}
        </div>
      </div>
      {scoringDesc && (
        <p className="mt-1.5 text-[10px] font-semibold text-accent/80">
          {scoringDesc}
        </p>
      )}
    </button>
  );
}

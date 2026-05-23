"use client";

import {
  Badge,
  Card,
  CardContent,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
  ProgressBar,
  TabButton,
  TabsList
} from "@nihongo-bjt/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { learnerApiFetch } from "../../../../lib/learner-api";
import { useSharePostcard } from "../../../_hooks/use-share-postcard";
import { AchievementCelebration } from "./achievement-celebration";
import { CategoryFilter } from "./category-filter";
import { StreakCalendar } from "./streak-calendar";

/* ── Types ─────────────────────────────────────────────────────────────── */

interface StreakData {
  id: string;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null;
  freezesUsed: number;
  streakConfig: {
    name: string;
    activityType: string;
    freezesAllowed: number;
  };
}

interface AchievementTierBrowse {
  id: string;
  tier: string;
  threshold: number;
  iconUrl: string | null;
  nameKey: string | null;
  userProgress: {
    id: string;
    currentProgress: number;
    earnedAt: string | null;
  } | null;
}

interface AchievementDefBrowse {
  id: string;
  slug: string;
  nameKey: string;
  descriptionKey: string;
  category: string;
  iconUrl: string | null;
  displayOrder: number;
  tiers: AchievementTierBrowse[];
}

interface PendingAchievement {
  id: string;
  earnedAt: string;
  tier: {
    id: string;
    tier: string;
    threshold: number;
    nameKey: string | null;
    achievement: {
      slug: string;
      nameKey: string;
      descriptionKey: string;
      category: string;
    };
  };
}

interface LeaderboardConfig {
  id: string;
  name: string;
  metricType: string;
  period: string;
}

interface LeaderboardEntry {
  id: string;
  userId: string;
  rank: number;
  score: number;
  user?: { displayName: string | null; avatarUrl: string | null };
}

interface LeaderboardData {
  leaderboard: LeaderboardConfig;
  entries: LeaderboardEntry[];
}

interface MyRankData {
  rank: number;
  score: number;
}

type Tab = "streaks" | "achievements" | "leaderboards";

export interface GamificationLabels {
  title: string;
  eyebrow: string;
  subtitle: string;
  streaks: string;
  streakDays: string;
  longestStreak: string;
  currentStreak: string;
  freezesLeft: string;
  achievements: string;
  earned: string;
  inProgress: string;
  locked: string;
  progress: string;
  leaderboards: string;
  rank: string;
  yourRank: string;
  points: string;
  noStreaks: string;
  noAchievements: string;
  tiers: Record<string, string>;
  categories: Record<string, string>;
  error: string;
  // New keys
  recentlyEarned?: string;
  browseAll?: string;
  myProgress?: string;
  share?: string;
  celebration?: string;
  celebrationCta?: string;
  allCategories?: string;
  streakCalendar?: string;
  noLeaderboards?: string;
  myRank?: string;
  viewAll?: string;
  selectBoardHint?: string;
  viewAnalytics?: string;
  achievementNames?: Record<string, string>;
}

const TIER_COLORS: Record<string, string> = {
  bronze: "from-amber-600 to-amber-800",
  silver: "from-gray-300 to-gray-500",
  gold: "from-yellow-400 to-yellow-600",
  platinum: "from-cyan-300 to-blue-500"
};

const TIER_BG: Record<string, string> = {
  bronze: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-700",
  silver: "bg-gray-50 dark:bg-gray-800/30 border-gray-200 dark:border-gray-600",
  gold: "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-700",
  platinum: "bg-cyan-50 dark:bg-cyan-950/30 border-blue-200 dark:border-blue-700"
};

const RANK_MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

/** Emoji icon per achievement slug — portable, no external URL required */
const ACHIEVEMENT_ICON: Record<string, string> = {
  "vocab-master": "📚",
  "kanji-scholar": "漢",
  "grammar-sage": "📝",
  "streak-champion": "🔥",
  "battle-warrior": "⚔️",
  "quiz-ace": "🎯",
  "review-diligent": "🔄",
  "daily-explorer": "🌅",
};

/** Resolve an i18n key like "achievement.vocab_master.name" to its translated text */
function resolveAchievementKey(key: string | null | undefined, names?: Record<string, string>): string {
  if (!key) return "";
  if (names && names[key]) return names[key];
  // Fallback: extract last segment and humanize (e.g., "achievement.vocab_master.name" → "Vocab Master")
  const parts = key.split(".");
  const last = parts[parts.length - 1];
  if (last === "name" || last === "description") {
    const slug = parts[parts.length - 2] ?? last;
    return slug.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  }
  return key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

/* ── Component ─────────────────────────────────────────────────────────── */

export function AchievementsPageClient({
  labels,
  locale: _locale
}: {
  labels: GamificationLabels;
  locale: string;
}) {
  void _locale;

  const [tab, setTab] = useState<Tab>("achievements");
  const [streaks, setStreaks] = useState<StreakData[]>([]);
  const [browseData, setBrowseData] = useState<AchievementDefBrowse[]>([]);
  const [pendingAchievements, setPendingAchievements] = useState<PendingAchievement[]>([]);
  const [leaderboards, setLeaderboards] = useState<LeaderboardConfig[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<LeaderboardData | null>(null);
  const [myRank, setMyRank] = useState<MyRankData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [celebrationItem, setCelebrationItem] = useState<PendingAchievement | null>(null);

  const { share, sharing } = useSharePostcard();

  /* ── Load data ───────────────────────────────────────────────────────── */

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [streaksRes, browseRes, pendingRes, boardsRes] = await Promise.all([
          learnerApiFetch("/api/gamification/streaks"),
          learnerApiFetch("/api/gamification/achievements/browse"),
          learnerApiFetch("/api/gamification/achievements/me/pending"),
          learnerApiFetch("/api/gamification/leaderboards")
        ]);

        if (streaksRes.ok) setStreaks(await streaksRes.json());
        if (browseRes.ok) setBrowseData(await browseRes.json());
        if (pendingRes.ok) {
          const pending: PendingAchievement[] = await pendingRes.json();
          setPendingAchievements(pending);
          // Show celebration for the first pending achievement
          if (pending.length > 0) setCelebrationItem(pending[0]);
        }
        if (boardsRes.ok) setLeaderboards(await boardsRes.json());
      } catch {
        setError(labels.error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [labels.error]);

  /* ── Handlers ────────────────────────────────────────────────────────── */

  const loadLeaderboard = useCallback(async (id: string) => {
    try {
      const [boardRes, rankRes] = await Promise.all([
        learnerApiFetch(`/api/gamification/leaderboards/${id}`),
        learnerApiFetch(`/api/gamification/leaderboards/${id}/my-rank`)
      ]);
      if (boardRes.ok) setSelectedBoard(await boardRes.json());
      if (rankRes.ok) setMyRank(await rankRes.json());
      else setMyRank(null);
    } catch {
      setError(labels.error);
    }
  }, [labels.error]);

  const dismissCelebration = useCallback(async () => {
    if (!celebrationItem) return;
    setCelebrationItem(null);
    // Acknowledge in background
    try {
      await learnerApiFetch("/api/gamification/achievements/me/acknowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: pendingAchievements.map(p => p.id) })
      });
    } catch { /* non-blocking */ }
  }, [celebrationItem, pendingAchievements]);

  const handleShare = useCallback(async (achievementSlug: string) => {
    await share("/api/sharing/achievement", { achievementSlug });
  }, [share]);

  /* ── Derived data ────────────────────────────────────────────────────── */

  const filteredAchievements = useMemo(() => {
    if (!categoryFilter) return browseData;
    return browseData.filter(d => d.category === categoryFilter);
  }, [browseData, categoryFilter]);

  const stats = useMemo(() => {
    let earned = 0;
    let inProgress = 0;
    let total = 0;
    for (const def of browseData) {
      for (const tier of def.tiers) {
        total++;
        if (tier.userProgress?.earnedAt) earned++;
        else if (tier.userProgress && tier.userProgress.currentProgress > 0) inProgress++;
      }
    }
    return { earned, inProgress, total };
  }, [browseData]);

  const primaryStreak = streaks[0] ?? null;

  /* ── Render ──────────────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl px-3 py-6 sm:px-5">
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-3 py-6 sm:px-5">
      {/* Celebration overlay */}
      {celebrationItem && (
        <AchievementCelebration
          show={!!celebrationItem}
          achievementName={resolveAchievementKey(celebrationItem.tier.achievement.nameKey, labels.achievementNames)}
          tier={celebrationItem.tier.tier}
          onDismiss={dismissCelebration}
          labels={{
            celebration: labels.celebration ?? "Thành tích mới!",
            celebrationCta: labels.celebrationCta ?? "Tuyệt vời!"
          }}
        />
      )}

      <PageHeader eyebrow={labels.eyebrow} title={labels.title} />

      {/* ── Summary Stats Bar ──────────────────────────────────────── */}
      <div className="mt-5 grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 p-4 text-center text-white shadow-lg shadow-orange-200/40 dark:shadow-orange-900/20">
          <div className="text-2xl font-black">{primaryStreak?.currentStreak ?? 0}</div>
          <div className="mt-0.5 text-xs font-medium opacity-90">{labels.currentStreak}</div>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 p-4 text-center text-white shadow-lg shadow-emerald-200/40 dark:shadow-emerald-900/20">
          <div className="text-2xl font-black">{stats.earned}</div>
          <div className="mt-0.5 text-xs font-medium opacity-90">{labels.earned}</div>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-600 p-4 text-center text-white shadow-lg shadow-blue-200/40 dark:shadow-blue-900/20">
          <div className="text-2xl font-black">{stats.inProgress}</div>
          <div className="mt-0.5 text-xs font-medium opacity-90">{labels.inProgress}</div>
        </div>
      </div>

      {error && (
        <div className="my-4">
          <ErrorState title={error} />
        </div>
      )}

      {/* Tabs */}
      <TabsList className="mt-6">
        <TabButton active={tab === "achievements"} onClick={() => setTab("achievements")}>
          {labels.achievements}
        </TabButton>
        <TabButton active={tab === "streaks"} onClick={() => setTab("streaks")}>
          {labels.streaks}
        </TabButton>
        <TabButton active={tab === "leaderboards"} onClick={() => setTab("leaderboards")}>
          {labels.leaderboards}
        </TabButton>
      </TabsList>

      {/* ── Achievements Tab ───────────────────────────────────────── */}
      {tab === "achievements" && (
        <div className="mt-6 space-y-5">
          {/* Recently earned spotlight */}
          {pendingAchievements.length > 0 && (
            <div className="rounded-2xl border border-yellow-200 bg-gradient-to-r from-yellow-50 to-amber-50 p-4 dark:border-yellow-800 dark:from-yellow-950/20 dark:to-amber-950/20">
              <h3 className="mb-3 text-sm font-bold text-yellow-800 dark:text-yellow-200">
                🎉 {labels.recentlyEarned ?? "Mới đạt được"}
              </h3>
              <div className="flex flex-wrap gap-3">
                {pendingAchievements.map(p => (
                  <div key={p.id} className="flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 shadow-sm dark:bg-gray-800/80">
                    <span className="text-lg">{p.tier.tier === "gold" ? "🥇" : p.tier.tier === "silver" ? "🥈" : p.tier.tier === "platinum" ? "💎" : "🥉"}</span>
                    <span className="text-xs font-medium text-ink">{resolveAchievementKey(p.tier.achievement.nameKey, labels.achievementNames)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Category filter */}
          <CategoryFilter
            categories={labels.categories}
            selected={categoryFilter}
            onSelect={setCategoryFilter}
            allLabel={labels.allCategories ?? "Tất cả"}
          />

          {/* Achievement bento grid */}
          {filteredAchievements.length === 0 ? (
            <EmptyState title={labels.noAchievements} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredAchievements.map((def) => {
                // Show highest relevant tier (first earned or first in-progress)
                const bestTier = def.tiers.find(t => t.userProgress?.earnedAt)
                  ?? def.tiers.find(t => t.userProgress && t.userProgress.currentProgress > 0)
                  ?? def.tiers[0];
                if (!bestTier) return null;

                const progress = bestTier.userProgress;
                const earned = !!progress?.earnedAt;
                const hasProgress = progress && progress.currentProgress > 0;
                const pct = progress
                  ? Math.min((progress.currentProgress / bestTier.threshold) * 100, 100)
                  : 0;
                const tierName = labels.tiers[bestTier.tier] ?? bestTier.tier;
                const category = labels.categories[def.category] ?? def.category;

                // Bento: earned achievements get more visual weight
                const isHero = earned && bestTier.tier === "platinum";

                return (
                  <Card
                    key={def.id}
                    className={`group border-2 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${
                      isHero ? "sm:col-span-2" : ""
                    } ${
                      earned
                        ? TIER_BG[bestTier.tier] ?? "bg-surface border-accent"
                        : hasProgress
                          ? "border-accent/30 bg-surface dark:bg-gray-900"
                          : "border-transparent opacity-60 hover:opacity-90 bg-surface dark:bg-gray-900"
                    }`}
                  >
                    <CardContent className={`p-5 ${isHero ? "sm:p-6" : ""}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {/* Tier badge with gradient */}
                          <div
                            className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-lg text-white shadow-md transition-transform group-hover:scale-110 ${
                              TIER_COLORS[bestTier.tier] ?? "from-gray-400 to-gray-600"
                            }`}
                          >
                            {earned
                              ? (ACHIEVEMENT_ICON[def.slug] ?? "★")
                              : hasProgress
                                ? (ACHIEVEMENT_ICON[def.slug] ?? "☆")
                                : "🔒"}
                          </div>
                          <div className="min-w-0">
                            <h4 className="truncate font-bold text-ink">
                              {resolveAchievementKey(def.nameKey, labels.achievementNames)}
                            </h4>
                            <p className="text-xs text-ink/50">
                              {tierName} • {category}
                            </p>
                          </div>
                        </div>
                        {earned && (
                          <div className="flex items-center gap-1.5">
                            <Badge tone="success">{labels.earned}</Badge>
                            <button
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent transition-colors hover:bg-accent/20 active:scale-90"
                              onClick={() => handleShare(def.slug)}
                              disabled={sharing}
                              title={labels.share ?? "Chia sẻ"}
                              aria-label={labels.share ?? "Chia sẻ"}
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                      <p className="mt-2 text-sm text-ink/60 line-clamp-2">
                        {resolveAchievementKey(def.descriptionKey, labels.achievementNames)}
                      </p>

                      {/* Progress bar for in-progress */}
                      {!earned && hasProgress && (
                        <div className="mt-3">
                          <div className="mb-1 flex justify-between text-xs text-ink/50">
                            <span>
                              {labels.progress
                                .replace("{current}", String(progress.currentProgress))
                                .replace("{target}", String(bestTier.threshold))}
                            </span>
                            <span>{Math.round(pct)}%</span>
                          </div>
                          <ProgressBar value={pct} />
                        </div>
                      )}

                      {/* Locked state */}
                      {!earned && !hasProgress && (
                        <div className="mt-3 text-xs text-ink/40">
                          {labels.locked ?? "Chưa mở khóa"} • {labels.progress.replace("{current}", "0").replace("{target}", String(bestTier.threshold))}
                        </div>
                      )}

                      {/* Tier progression dots */}
                      {def.tiers.length > 1 && (
                        <div className="mt-3 flex items-center gap-1.5">
                          {def.tiers.map((t) => (
                            <div
                              key={t.id}
                              className={`h-2 w-2 rounded-full transition-colors ${
                                t.userProgress?.earnedAt
                                  ? "bg-emerald-500"
                                  : t.userProgress && t.userProgress.currentProgress > 0
                                    ? "bg-accent/50"
                                    : "bg-gray-200 dark:bg-gray-700"
                              }`}
                              title={`${labels.tiers[t.tier] ?? t.tier}: ${t.threshold}`}
                            />
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Streaks Tab ────────────────────────────────────────────── */}
      {tab === "streaks" && (
        <div className="mt-6 space-y-4">
          {streaks.length === 0 ? (
            <EmptyState title={labels.noStreaks} />
          ) : (
            streaks.map((s) => (
              <Card key={s.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex items-center gap-5 p-5">
                    {/* Streak ring */}
                    <div className="relative flex h-20 w-20 flex-shrink-0 items-center justify-center">
                      <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 36 36">
                        <circle
                          cx="18" cy="18" r="15.9"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="text-gray-100 dark:text-gray-700"
                        />
                        <circle
                          cx="18" cy="18" r="15.9"
                          fill="none"
                          stroke="url(#streak-gradient)"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeDasharray={`${Math.min((s.currentStreak / Math.max(s.longestStreak, 30)) * 100, 100)}, 100`}
                          className="transition-all duration-1000"
                        />
                        <defs>
                          <linearGradient id="streak-gradient">
                            <stop offset="0%" stopColor="#f97316" />
                            <stop offset="100%" stopColor="#ef4444" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <span className="text-2xl">🔥</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-ink truncate">
                        {s.streakConfig.name}
                      </h3>
                      <div className="mt-1.5 flex items-baseline gap-2">
                        <span className="text-3xl font-black text-accent tabular-nums">
                          {s.currentStreak}
                        </span>
                        <span className="text-sm text-ink/50">
                          {labels.streakDays.replace("{count}", "").trim()}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-4 text-xs text-ink/50">
                        <span>
                          {labels.longestStreak}: <strong className="text-ink/70">{s.longestStreak}</strong>
                        </span>
                        {s.streakConfig.freezesAllowed > 0 && (
                          <span>
                            ❄️ {s.streakConfig.freezesAllowed - s.freezesUsed} {labels.freezesLeft}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Streak calendar heatmap */}
                  <div className="border-t border-border/50 px-5 pb-4">
                    <StreakCalendar
                      lastActivityDate={s.lastActivityDate}
                      currentStreak={s.currentStreak}
                      label={labels.streakCalendar ?? "Lịch học tập"}
                    />
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ── Leaderboards Tab ───────────────────────────────────────── */}
      {tab === "leaderboards" && (
        <div className="mt-6 space-y-4">
          {leaderboards.length === 0 ? (
            <EmptyState title={labels.noLeaderboards ?? "Chưa có bảng xếp hạng"} />
          ) : (
            <>
              {/* Board selector */}
              <div className="flex flex-wrap gap-2">
                {leaderboards.map((b) => (
                  <button
                    key={b.id}
                    className={`min-h-[44px] rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 ${
                      selectedBoard?.leaderboard.id === b.id
                        ? "bg-accent text-white shadow-md shadow-accent/20 scale-105"
                        : "bg-surface text-ink/70 hover:bg-surface-hover active:scale-95 dark:bg-gray-800"
                    }`}
                    onClick={() => loadLeaderboard(b.id)}
                  >
                    {b.name}
                  </button>
                ))}
              </div>

              {/* My rank highlight */}
              {myRank && (
                <div className="flex items-center gap-4 rounded-2xl border-2 border-accent/30 bg-accent/5 p-4 dark:bg-accent/10">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-lg font-bold text-white">
                    #{myRank.rank}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-ink">{labels.yourRank}</div>
                    <div className="text-xs text-ink/60">
                      {myRank.score} {labels.points}
                    </div>
                  </div>
                </div>
              )}

              {/* Entries */}
              {selectedBoard && (
                <Card className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="divide-y divide-border/50">
                      {selectedBoard.entries.map((entry, i) => (
                        <div
                          key={entry.id}
                          className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${
                            i < 3 ? "bg-gradient-to-r from-accent/5 to-transparent" : ""
                          }`}
                        >
                          {/* Rank */}
                          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center">
                            {i < 3 ? (
                              <span className="text-xl">{RANK_MEDAL[i + 1]}</span>
                            ) : (
                              <span className="text-sm font-bold text-ink/50">
                                {entry.rank || i + 1}
                              </span>
                            )}
                          </div>

                          {/* Avatar + name */}
                          <div className="flex flex-1 items-center gap-3 min-w-0">
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent/20 to-accent/5 text-xs font-bold text-accent">
                              {(entry.user?.displayName ?? entry.userId)?.[0]?.toUpperCase() ?? "?"}
                            </div>
                            <span className="truncate text-sm font-medium text-ink">
                              {entry.user?.displayName ?? `User ${entry.userId.slice(0, 6)}`}
                            </span>
                          </div>

                          {/* Score */}
                          <div className="text-sm font-bold tabular-nums text-accent">
                            {entry.score.toLocaleString()} <span className="text-xs font-normal text-ink/40">{labels.points}</span>
                          </div>
                        </div>
                      ))}
                      {selectedBoard.entries.length === 0 && (
                        <div className="px-5 py-10 text-center text-sm text-ink/40">
                          {labels.noLeaderboards ?? "Chưa có dữ liệu"}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Prompt to select if none selected */}
              {!selectedBoard && (
                <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-ink/40">
                  {labels.selectBoardHint ?? "← Select a leaderboard"}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Cross-navigation */}
      <div className="mt-8 flex justify-center">
        <Link
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-ink/10 bg-surface px-5 text-sm font-semibold text-muted transition-all hover:border-ink/20 hover:bg-paper hover:text-ink hover:shadow-sm"
          href={`/${_locale}/analytics`}
        >
          <span>📈</span>
          {labels.viewAnalytics ?? "View learning analytics"}
        </Link>
      </div>
    </div>
  );
}

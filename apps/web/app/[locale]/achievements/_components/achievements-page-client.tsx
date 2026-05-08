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
import { useCallback, useEffect, useState } from "react";

import { learnerApiFetch } from "../../../../lib/learner-api";

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

interface AchievementData {
  id: string;
  currentProgress: number;
  earnedAt: string | null;
  tier: {
    id: string;
    tier: string;
    threshold: number;
    iconUrl: string | null;
    nameKey: string | null;
    achievement: {
      slug: string;
      nameKey: string;
      descriptionKey: string;
      category: string;
      iconUrl: string | null;
    };
  };
}

interface LeaderboardConfig {
  id: string;
  name: string;
  metricType: string;
  period: string;
}

interface LeaderboardData {
  leaderboard: LeaderboardConfig;
  entries: Array<{
    id: string;
    userId: string;
    rank: number;
    score: number;
  }>;
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
}

const TIER_COLORS: Record<string, string> = {
  bronze: "from-amber-600 to-amber-800",
  silver: "from-gray-300 to-gray-500",
  gold: "from-yellow-400 to-yellow-600",
  platinum: "from-cyan-300 to-blue-500"
};

const TIER_BG: Record<string, string> = {
  bronze: "bg-amber-50 border-amber-200",
  silver: "bg-gray-50 border-gray-200",
  gold: "bg-yellow-50 border-yellow-200",
  platinum: "bg-cyan-50 border-blue-200"
};

/* ── Component ─────────────────────────────────────────────────────────── */

export function AchievementsPageClient({
  labels,
  locale: _locale
}: {
  labels: GamificationLabels;
  locale: string;
}) {
  void _locale;

  const [tab, setTab] = useState<Tab>("streaks");
  const [streaks, setStreaks] = useState<StreakData[]>([]);
  const [achievements, setAchievements] = useState<AchievementData[]>([]);
  const [leaderboards, setLeaderboards] = useState<LeaderboardConfig[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ── Load data ───────────────────────────────────────────────────────── */

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [streaksRes, achievementsRes, boardsRes] = await Promise.all([
          learnerApiFetch("/api/gamification/streaks"),
          learnerApiFetch("/api/gamification/achievements/me"),
          learnerApiFetch("/api/gamification/leaderboards")
        ]);

        if (streaksRes.ok) setStreaks(await streaksRes.json());
        if (achievementsRes.ok) setAchievements(await achievementsRes.json());
        if (boardsRes.ok) setLeaderboards(await boardsRes.json());
      } catch {
        setError(labels.error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [labels.error]);

  const loadLeaderboard = useCallback(async (id: string) => {
    try {
      const res = await learnerApiFetch(`/api/gamification/leaderboards/${id}`);
      if (res.ok) setSelectedBoard(await res.json());
    } catch {
      setError(labels.error);
    }
  }, [labels.error]);

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
      <PageHeader eyebrow={labels.eyebrow} title={labels.title} />

      {error && (
        <div className="my-4">
          <ErrorState title={error} />
        </div>
      )}

      {/* Tabs */}
      <TabsList className="mt-6">
        <TabButton active={tab === "streaks"} onClick={() => setTab("streaks")}>
          {labels.streaks}
        </TabButton>
        <TabButton active={tab === "achievements"} onClick={() => setTab("achievements")}>
          {labels.achievements}
        </TabButton>
        <TabButton active={tab === "leaderboards"} onClick={() => setTab("leaderboards")}>
          {labels.leaderboards}
        </TabButton>
      </TabsList>

      {/* ── Streaks ────────────────────────────────────────────────── */}
      {tab === "streaks" && (
        <div className="mt-6 space-y-4">
          {streaks.length === 0 ? (
            <EmptyState title={labels.noStreaks} />
          ) : (
            streaks.map((s) => (
              <Card key={s.id}>
                <CardContent className="flex items-center gap-6 p-5">
                  {/* Flame icon */}
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 text-3xl text-white shadow-lg">
                    🔥
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-ink">
                      {s.streakConfig.name}
                    </h3>
                    <div className="mt-1 flex items-center gap-4 text-sm text-ink/60">
                      <span>
                        {labels.currentStreak}:{" "}
                        <strong className="text-accent">
                          {labels.streakDays.replace("{count}", String(s.currentStreak))}
                        </strong>
                      </span>
                      <span>
                        {labels.longestStreak}:{" "}
                        <strong>
                          {labels.streakDays.replace("{count}", String(s.longestStreak))}
                        </strong>
                      </span>
                    </div>
                    {s.streakConfig.freezesAllowed > 0 && (
                      <div className="mt-1 text-xs text-ink/40">
                        {labels.freezesLeft}: {s.streakConfig.freezesAllowed - s.freezesUsed}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ── Achievements ───────────────────────────────────────────── */}
      {tab === "achievements" && (
        <div className="mt-6 space-y-4">
          {achievements.length === 0 ? (
            <EmptyState title={labels.noAchievements} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {achievements.map((a) => {
                const earned = !!a.earnedAt;
                const tierName = labels.tiers[a.tier.tier] ?? a.tier.tier;
                const category = labels.categories[a.tier.achievement.category] ?? a.tier.achievement.category;
                const pct = Math.min((a.currentProgress / a.tier.threshold) * 100, 100);

                return (
                  <Card
                    key={a.id}
                    className={`border-2 transition-all ${
                      earned
                        ? TIER_BG[a.tier.tier] ?? "bg-surface border-accent"
                        : "border-transparent opacity-80"
                    }`}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br text-lg text-white ${
                              TIER_COLORS[a.tier.tier] ?? "from-gray-400 to-gray-600"
                            }`}
                          >
                            {earned ? "★" : "☆"}
                          </div>
                          <div>
                            <h4 className="font-bold text-ink">
                              {a.tier.achievement.nameKey}
                            </h4>
                            <p className="text-xs text-ink/50">
                              {tierName} • {category}
                            </p>
                          </div>
                        </div>
                        {earned && (
                          <Badge tone="success">{labels.earned}</Badge>
                        )}
                      </div>
                      <p className="mt-2 text-sm text-ink/60">
                        {a.tier.achievement.descriptionKey}
                      </p>
                      {!earned && (
                        <div className="mt-3">
                          <div className="mb-1 flex justify-between text-xs text-ink/50">
                            <span>
                              {labels.progress
                                .replace("{current}", String(a.currentProgress))
                                .replace("{target}", String(a.tier.threshold))}
                            </span>
                            <span>{Math.round(pct)}%</span>
                          </div>
                          <ProgressBar value={pct} />
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

      {/* ── Leaderboards ───────────────────────────────────────────── */}
      {tab === "leaderboards" && (
        <div className="mt-6 space-y-4">
          {/* Board selector */}
          <div className="flex flex-wrap gap-2">
            {leaderboards.map((b) => (
              <button
                key={b.id}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  selectedBoard?.leaderboard.id === b.id
                    ? "bg-accent text-white"
                    : "bg-surface text-ink/70 hover:bg-surface-hover"
                }`}
                onClick={() => loadLeaderboard(b.id)}
              >
                {b.name}
              </button>
            ))}
          </div>

          {/* Entries */}
          {selectedBoard && (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {selectedBoard.entries.map((entry, i) => (
                    <div
                      key={entry.id}
                      className={`flex items-center gap-4 px-5 py-3 ${
                        i < 3 ? "bg-accent/5" : ""
                      }`}
                    >
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                          i === 0
                            ? "bg-yellow-400 text-yellow-900"
                            : i === 1
                              ? "bg-gray-300 text-gray-700"
                              : i === 2
                                ? "bg-amber-600 text-white"
                                : "bg-surface text-ink/60"
                        }`}
                      >
                        {entry.rank || i + 1}
                      </div>
                      <div className="flex-1 text-sm font-medium text-ink">
                        {entry.userId.slice(0, 8)}…
                      </div>
                      <div className="text-sm font-bold text-accent">
                        {entry.score} {labels.points}
                      </div>
                    </div>
                  ))}
                  {selectedBoard.entries.length === 0 && (
                    <div className="px-5 py-8 text-center text-sm text-ink/40">
                      {labels.noAchievements}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

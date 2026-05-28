"use client";

interface StatsData {
  currentStreak: number | null;
  longestStreak: number | null;
  totalStudyDays: number | null;
  achievementCount: number | null;
  battleWins: number | null;
  battleTotal: number | null;
  battleWinRate: number | null;
}

interface Props {
  stats: StatsData;
  labels: {
    achievements: string;
    battles: string;
    days: string;
    longestStreak: string;
    studyDays: string;
    streak: string;
    winRate: string;
    wins: string;
  };
}

export function ProfileStats({ stats, labels }: Props) {
  const items = [
    {
      icon: "🔥",
      label: labels.streak,
      value: stats.currentStreak ?? 0,
      suffix: labels.days,
      accent: "text-amber",
    },
    {
      icon: "🏆",
      label: labels.longestStreak,
      value: stats.longestStreak ?? 0,
      suffix: labels.days,
      accent: "text-amber",
    },
    {
      icon: "📚",
      label: labels.studyDays,
      value: stats.totalStudyDays ?? 0,
      suffix: "",
      accent: "text-accent",
    },
    {
      icon: "⭐",
      label: labels.achievements,
      value: stats.achievementCount ?? 0,
      suffix: "",
      accent: "text-sakura",
    },
    {
      icon: "⚔️",
      label: labels.battles,
      value: stats.battleTotal ?? 0,
      suffix: `(${stats.battleWins ?? 0}${labels.wins})`,
      accent: "text-accent",
    },
    {
      icon: "📊",
      label: labels.winRate,
      value: stats.battleWinRate != null ? `${stats.battleWinRate}%` : "—",
      suffix: "",
      accent: "text-leaf",
    },
  ];

  return (
    <section className="mt-8">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="relative overflow-hidden rounded-2xl bg-surface border border-muted/8 p-4 group hover:shadow-md hover:border-accent/20 transition-all duration-200"
          >
            {/* Subtle gradient accent */}
            <div className="absolute top-0 right-0 w-16 h-16 opacity-[0.04] bg-gradient-to-bl from-accent rounded-bl-full" />

            <div className="text-2xl mb-1">{item.icon}</div>
            <div className={`text-xl sm:text-2xl font-bold tabular-nums ${item.accent}`}>
              {item.value}
              {item.suffix && (
                <span className="text-xs font-normal text-muted ml-1">{item.suffix}</span>
              )}
            </div>
            <div className="text-xs text-muted mt-0.5 font-medium">{item.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

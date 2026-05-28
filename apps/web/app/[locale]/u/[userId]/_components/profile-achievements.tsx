"use client";

interface Achievement {
  id: string;
  slug: string;
  name: string;
  iconUrl: string | null;
  unlockedAt: string;
}

interface Props {
  achievements: Achievement[];
  labels: { title: string; viewAll: string };
}

export function ProfileAchievements({ achievements, labels }: Props) {
  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-ink">{labels.title}</h2>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
        {achievements.map((ach) => (
          <div
            key={ach.id}
            className="flex-shrink-0 w-[100px] flex flex-col items-center gap-2 p-3 rounded-2xl bg-surface border border-muted/8 hover:shadow-md hover:border-accent/15 transition-all duration-200 group"
          >
            <div className="w-12 h-12 rounded-full bg-amber/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
              {ach.iconUrl ? (
                <img src={ach.iconUrl} alt={ach.name} className="w-8 h-8" />
              ) : (
                <span className="text-xl">🏅</span>
              )}
            </div>
            <span className="text-[11px] leading-tight text-center text-ink/80 font-medium line-clamp-2">
              {ach.name}
            </span>
            <span className="text-[10px] text-muted">
              {new Date(ach.unlockedAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

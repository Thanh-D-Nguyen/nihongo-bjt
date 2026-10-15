"use client";

import { cn } from "@nihongo-bjt/ui";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGoAuth } from "../../../../lib/go-auth-provider";
import { learnerApiFetch } from "../../../../lib/learner-api";

interface Scenario {
  id: string;
  slug: string;
  titleVi: string;
  titleJa?: string | null;
  descriptionVi: string | null;
  difficulty: string;
  category: string;
  iconEmoji: string;
  estimatedMin: number;
  _count: { steps: number; attempts: number };
}

interface ScenarioListCopy {
  title: string;
  description: string;
  difficulty: Record<string, string>;
  duration: string;
  steps: string;
  attempts: string;
  empty: string;
  loadError: string;
  retry: string;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "bg-[var(--color-matcha)]/15 text-[var(--color-matcha)]",
  intermediate: "bg-[var(--color-gold,#f59e0b)]/15 text-[var(--color-gold,#f59e0b)]",
  advanced: "bg-[var(--color-sakura)]/15 text-[var(--color-sakura)]",
};

export function ScenarioListClient({ locale, copy }: { locale: string; copy: ScenarioListCopy }) {
  const { userId } = useGoAuth();
  const router = useRouter();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(false);
    try {
      const r = await learnerApiFetch("/api/scenarios");
      if (!r.ok) throw new Error("load scenarios");
      const data: unknown = await r.json();
      if (!Array.isArray(data)) throw new Error("invalid scenarios response");
      setScenarios(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl p-4 space-y-4">
        <div className="h-8 w-48 rounded bg-ink/10 animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-ink/5 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-4">
      <h1 className="text-xl font-black text-ink mb-1">
        💼 {copy.title}
      </h1>
      <p className="text-sm text-muted mb-6">
        {copy.description}
      </p>

      <div className="space-y-3">
        {scenarios.map((s) => (
          <button
            key={s.id}
            onClick={() => router.push(`/${locale}/scenarios/${s.id}`)}
            className="w-full rounded-2xl border border-ink/8 bg-surface p-4 text-left shadow-sm transition-all hover:shadow-md hover:border-ink/15 active:scale-[0.99]"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">{s.iconEmoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-ink truncate">
                    {locale === "vi" ? s.titleVi : s.titleJa || s.titleVi}
                  </h3>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold",
                      DIFFICULTY_COLORS[s.difficulty],
                    )}
                  >
                    {copy.difficulty[s.difficulty] ?? s.difficulty}
                  </span>
                </div>
                {locale === "vi" && s.descriptionVi && (
                  <p className="mt-1 text-xs text-muted line-clamp-2">
                    {s.descriptionVi}
                  </p>
                )}
                <div className="mt-2 flex gap-3 text-[10px] text-muted">
                  <span>{copy.duration.replace("{count}", String(s.estimatedMin))}</span>
                  <span>{copy.steps.replace("{count}", String(s._count.steps))}</span>
                  <span>{copy.attempts.replace("{count}", String(s._count.attempts))}</span>
                </div>
              </div>
              <span className="text-muted text-sm">→</span>
            </div>
          </button>
        ))}
      </div>

      {error && (
        <div role="alert" className="text-center py-8">
          <p className="text-sm text-muted">{copy.loadError}</p>
          <button type="button" onClick={() => void load()} className="mt-3 min-h-12 rounded-xl px-4 font-semibold">
            {copy.retry}
          </button>
        </div>
      )}

      {!error && scenarios.length === 0 && (
        <div className="text-center py-12">
          <p className="text-4xl">💼</p>
          <p className="mt-3 text-sm text-muted">{copy.empty}</p>
        </div>
      )}
    </div>
  );
}

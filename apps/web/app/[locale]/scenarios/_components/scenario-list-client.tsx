"use client";

import { cn } from "@nihongo-bjt/ui";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";
import { learnerApiFetch } from "../../../../lib/learner-api";

interface Scenario {
  id: string;
  slug: string;
  titleVi: string;
  descriptionVi: string | null;
  difficulty: string;
  category: string;
  iconEmoji: string;
  estimatedMin: number;
  _count: { steps: number; attempts: number };
}

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "bg-[var(--color-matcha)]/15 text-[var(--color-matcha)]",
  intermediate: "bg-[var(--color-gold,#f59e0b)]/15 text-[var(--color-gold,#f59e0b)]",
  advanced: "bg-[var(--color-sakura)]/15 text-[var(--color-sakura)]",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: "Cơ bản",
  intermediate: "Trung cấp",
  advanced: "Nâng cao",
};

export function ScenarioListClient({ locale }: { locale: string }) {
  const { userId } = useKeycloakAuth();
  const router = useRouter();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const r = await learnerApiFetch("/api/scenarios");
      if (r.ok) setScenarios(await r.json());
    } catch {
      /* no-op */
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
        💼 Tình huống kinh doanh
      </h1>
      <p className="text-sm text-muted mb-6">
        Luyện tập ứng xử trong môi trường làm việc Nhật Bản
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
                    {s.titleVi}
                  </h3>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold",
                      DIFFICULTY_COLORS[s.difficulty],
                    )}
                  >
                    {DIFFICULTY_LABELS[s.difficulty] ?? s.difficulty}
                  </span>
                </div>
                {s.descriptionVi && (
                  <p className="mt-1 text-xs text-muted line-clamp-2">
                    {s.descriptionVi}
                  </p>
                )}
                <div className="mt-2 flex gap-3 text-[10px] text-muted">
                  <span>⏱️ ~{s.estimatedMin} phút</span>
                  <span>📋 {s._count.steps} bước</span>
                  <span>🎮 {s._count.attempts} lượt chơi</span>
                </div>
              </div>
              <span className="text-muted text-sm">→</span>
            </div>
          </button>
        ))}
      </div>

      {scenarios.length === 0 && (
        <div className="text-center py-12">
          <p className="text-4xl">💼</p>
          <p className="mt-3 text-sm text-muted">Chưa có tình huống nào.</p>
        </div>
      )}
    </div>
  );
}

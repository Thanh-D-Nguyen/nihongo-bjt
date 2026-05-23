"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";
import { careerMe, type CareerMeResponse } from "../../../../src/features/career-rpg/api";
import type { HomepageLabels } from "./types";

export function CareerXpWidget({ labels, locale }: { labels: HomepageLabels; locale: string }) {
  const { userId } = useKeycloakAuth();
  const [career, setCareer] = useState<CareerMeResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(userId));

  useEffect(() => {
    if (!userId) {
      setCareer(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void careerMe()
      .then((response) => {
        if (!cancelled) setCareer(response);
      })
      .catch(() => {
        if (!cancelled) setCareer(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!userId) return null;

  const progress =
    career && career.state.rankXpToNext > 0
      ? Math.min(100, Math.round((career.state.rankXp / career.state.rankXpToNext) * 100))
      : 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10">
          <svg className="h-4 w-4 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0z" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-600">Career XP</p>
          <h3 className="truncate text-sm font-bold text-slate-800">{labels.careerRpgTitle}</h3>
        </div>
      </div>

      {loading ? (
        <div className="mt-3 space-y-2" aria-busy>
          <div className="h-3 w-28 animate-pulse rounded bg-indigo-100" />
          <div className="h-2 w-full animate-pulse rounded-full bg-indigo-100" />
        </div>
      ) : career ? (
        <div className="mt-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xs font-semibold text-indigo-700">
              {labels.careerRpgRank}: {career.state.currentRankCode}
            </p>
            <p className="text-xs font-semibold tabular-nums text-slate-600">
              {career.state.rankXp} / {career.state.rankXpToNext} XP
            </p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-indigo-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-violet-500 transition-[width] duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 truncate text-xs text-slate-600">
            {career.rank.titleJa} · {career.rank.titleVi}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-600">{labels.careerRpgTitle}</p>
      )}

      <Link
        className="mt-3 inline-flex min-h-9 w-full items-center justify-center rounded-xl border border-indigo-200 bg-white px-3 text-xs font-bold text-indigo-700 shadow-sm transition-all hover:bg-indigo-50"
        href={`/${locale}/career`}
      >
        {labels.careerRpgCta}
      </Link>
    </div>
  );
}

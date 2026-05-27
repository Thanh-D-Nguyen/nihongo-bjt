"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";

interface LotoTeaser {
  drawNumber: number | null;
  drawDate: string;
  game: string;
  daysUntil: number;
  sets: Array<{ mainNumbers: number[] }>;
}

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/u, "");

export function LotoTeaserWidget({ locale }: { locale: string }) {
  const { accessToken } = useKeycloakAuth();
  const [teaser, setTeaser] = useState<LotoTeaser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTeaser = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API}/api/magazine/loto/next-draw?game=loto6`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTeaser(data);
      }
    } catch {
      // silently ignore — widget is optional
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchTeaser();
  }, [fetchTeaser]);

  // Don't render if no data or not logged in
  if (!accessToken || loading) return null;
  if (!teaser) return null;

  const firstSet = teaser.sets?.[0]?.mainNumbers ?? [];

  return (
    <Link
      href={`/${locale}/magazine/loto`}
      className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/8 via-teal-500/5 to-transparent p-4 transition-all duration-300 hover:border-emerald-500/40 hover:shadow-md hover:shadow-emerald-500/8 active:scale-[0.98]"
    >
      {/* Icon */}
      <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-2xl transition-transform duration-300 group-hover:scale-105">
        🎰
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-foreground">Loto Lab</span>
          {teaser.daysUntil !== undefined && teaser.daysUntil <= 3 && (
            <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-bold text-orange-600 dark:text-orange-400">
              {teaser.daysUntil === 0 ? "Hôm nay!" : `${teaser.daysUntil} ngày`}
            </span>
          )}
        </div>
        {/* Number pills preview */}
        {firstSet.length > 0 && (
          <div className="mt-1.5 flex gap-1">
            {firstSet.slice(0, 6).map((n, i) => (
              <span
                key={i}
                className="flex size-7 items-center justify-center rounded-full bg-emerald-500/10 text-[11px] font-bold text-emerald-700 dark:text-emerald-300"
              >
                {n}
              </span>
            ))}
            {firstSet.length > 6 && (
              <span className="flex size-7 items-center justify-center rounded-full bg-muted text-[11px] text-muted-foreground">
                +{firstSet.length - 6}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Arrow */}
      <svg className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </Link>
  );
}

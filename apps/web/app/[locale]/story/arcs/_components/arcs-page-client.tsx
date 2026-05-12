"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { storyArcs } from "../../../../../src/features/career-rpg/api";
import { MissionArcCard } from "../../../../../src/features/career-rpg/components/mission-arc-card";
import type { CareerRpgLabels } from "../../../../../src/features/career-rpg/i18n";
import type { MissionArc } from "../../../../../src/features/career-rpg/types";

interface Props {
  labels: CareerRpgLabels;
  locale: string;
}

export function ArcsPageClient({ labels, locale }: Props) {
  const [arcs, setArcs] = useState<MissionArc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void storyArcs()
      .then((items) => {
        if (alive) {
          setArcs(items);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (alive) {
          setError(err instanceof Error ? err.message : "Failed to load arcs");
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#6B7280]">
            {labels.arcs.eyebrow}
          </p>
          <h1 className="mt-1 text-3xl font-semibold leading-tight text-[#111827]">
            {labels.arcs.title}
          </h1>
          <p className="text-sm text-[#4B5563]">{labels.arcs.subtitle}</p>
        </div>
        <Link
          className="inline-flex min-h-9 items-center justify-center rounded-[10px] border border-[#E2E8F0] bg-white px-3 text-xs font-semibold text-[#111827] shadow-sm transition-colors hover:bg-[#F8FAFC]"
          href={`/${locale}/daily-standup`}
        >
          ← {labels.career.backHome}
        </Link>
      </header>

      {loading ? (
        <div className="py-12 text-center text-sm text-[#6B7280]">Loading…</div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : arcs.length === 0 ? (
        <div className="py-12 text-center text-sm text-[#6B7280]">No mission arcs available yet.</div>
      ) : null}

      <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...arcs]
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map((arc) => (
            <li key={arc.slug}>
              <MissionArcCard arc={arc} labels={labels.arcs} locale={locale} />
            </li>
          ))}
      </ul>
    </div>
  );
}

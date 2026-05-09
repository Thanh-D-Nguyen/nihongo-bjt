"use client";

import { Card } from "@nihongo-bjt/ui";
import Link from "next/link";

import { findRankByCode } from "../helpers";
import type { CareerRpgLabels } from "../i18n";
import type { MissionArc } from "../types";

interface Props {
  arc: MissionArc;
  locale: string;
  labels: CareerRpgLabels["arcs"];
}

const STATUS_TONE: Record<MissionArc["status"], { ring: string; chipBg: string; chipText: string }> = {
  active: {
    ring: "ring-[#3B82F6]/30",
    chipBg: "bg-[#EFF6FF]",
    chipText: "text-[#1D4ED8]"
  },
  completed: {
    ring: "ring-[#A7F3D0]/40",
    chipBg: "bg-[#ECFDF5]",
    chipText: "text-[#047857]"
  },
  locked: {
    ring: "ring-[#E2E8F0]",
    chipBg: "bg-[#F1F5F9]",
    chipText: "text-[#6B7280]"
  },
  draft: {
    ring: "ring-[#FDE68A]",
    chipBg: "bg-[#FEF3C7]",
    chipText: "text-[#B45309]"
  }
};

export function MissionArcCard({ arc, labels, locale }: Props) {
  const tone = STATUS_TONE[arc.status];
  const rank = findRankByCode(arc.rankCodeEntry);
  const progressPct =
    arc.totalChapters > 0 ? Math.round((arc.completedChapters / arc.totalChapters) * 100) : 0;
  const isLocked = arc.status === "locked";

  const statusLabel = {
    active: labels.statusActive,
    completed: labels.statusCompleted,
    locked: labels.statusLocked,
    draft: labels.statusLocked
  }[arc.status];

  const inner = (
    <Card
      className={`group relative h-full overflow-hidden ring-1 transition-shadow ${tone.ring} ${
        isLocked ? "opacity-70" : "hover:shadow-[0_8px_24px_-12px_rgba(15,23,42,0.18)]"
      }`}
    >
      <div className="h-1.5 w-full" style={{ background: arc.artAccent }} />
      <div className="flex h-full flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#6B7280]">
              {labels.rankRequired} {rank?.titleJa ?? arc.rankCodeEntry}
            </p>
            <h3 className="mt-1 text-lg font-semibold leading-tight text-[#111827]">
              {arc.titleJa}
            </h3>
            <p className="text-sm text-[#4B5563]">{arc.titleVi}</p>
          </div>
          <span
            className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${tone.chipBg} ${tone.chipText}`}
          >
            {statusLabel}
          </span>
        </div>
        <p className="line-clamp-3 text-sm leading-relaxed text-[#4B5563]">{arc.synopsisVi}</p>
        <div className="mt-auto space-y-2">
          <div className="flex items-baseline justify-between text-[11px] text-[#6B7280]">
            <span>{labels.chaptersProgress}</span>
            <span className="font-semibold text-[#111827]">
              {arc.completedChapters} / {arc.totalChapters}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#F1F5F9]">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${progressPct}%`, background: arc.artAccent }}
            />
          </div>
        </div>
        {!isLocked ? (
          <span className="text-xs font-medium text-[#1B2A4A] group-hover:text-[#3B82F6]">
            {labels.enterArc} →
          </span>
        ) : (
          <span className="text-xs text-[#9CA3AF]">{labels.notUnlocked}</span>
        )}
      </div>
    </Card>
  );

  if (isLocked) return inner;
  return (
    <Link className="block h-full" href={`/${locale}/story/arcs/${arc.slug}`}>
      {inner}
    </Link>
  );
}

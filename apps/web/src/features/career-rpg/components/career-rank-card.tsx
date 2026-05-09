"use client";

import { Card } from "@nihongo-bjt/ui";

import { findRankByCode, nextRank, rankProgressPct } from "../helpers";
import type { CareerRpgLabels } from "../i18n";
import type { UserCareerState } from "../types";

interface Props {
  state: UserCareerState;
  labels: CareerRpgLabels["career"];
  compact?: boolean;
}

export function CareerRankCard({ state, labels, compact = false }: Props) {
  const rank = findRankByCode(state.currentRankCode);
  const next = nextRank(state.currentRankCode);
  const pct = rankProgressPct(state);

  if (!rank) return null;

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-[auto_1fr] gap-5 p-5">
        <RankStamp titleJa={rank.titleJa} stampLabel={labels.rankBadgeStamp} />
        <div className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-[0.18em] text-[#6B7280]">
            {state.companyTheme === "mirai-shoji" ? "株式会社ミライ商事" : "Career"}
          </span>
          <h3 className="text-xl font-semibold leading-tight text-[#111827]">
            {state.jpWorkName}
          </h3>
          <p className="text-sm text-[#4B5563]">
            {rank.titleJa}
            <span className="mx-2 text-[#CBD5E1]">·</span>
            {rank.titleVi}
          </p>
          <p className="mt-1 text-xs text-[#6B7280]">BJT band: {rank.bjtBandTarget}</p>
        </div>
      </div>
      {!compact && (
        <div className="border-t border-dashed border-[#E2E8F0] px-5 py-4">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] uppercase tracking-[0.18em] text-[#6B7280]">
              {labels.rankProgressLabel}
            </span>
            <span className="text-xs text-[#4B5563]">
              {state.rankXp} / {state.rankXpToNext} XP
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#F1F5F9]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#1B2A4A] via-[#243560] to-[#3B82F6] transition-[width] duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-[#6B7280]">
            {labels.nextRankLabel}{" "}
            <span className="font-medium text-[#111827]">
              {next ? `${next.titleJa} · ${next.titleVi}` : "—"}
            </span>
          </p>
        </div>
      )}
    </Card>
  );
}

function RankStamp({ titleJa, stampLabel }: { titleJa: string; stampLabel: string }) {
  return (
    <div
      aria-label={stampLabel}
      className="relative flex h-20 w-20 items-center justify-center rounded-full border-2 border-[#9F1239] text-[#9F1239] shadow-[inset_0_0_0_1px_rgba(159,18,57,0.2)]"
    >
      <span className="select-none text-xl font-semibold tracking-[0.05em]">{titleJa}</span>
      <span className="absolute -bottom-1 -right-1 rounded-full bg-white px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#9F1239] shadow-sm">
        {stampLabel}
      </span>
    </div>
  );
}

"use client";

import { Card } from "@nihongo-bjt/ui";

import type { CareerRpgLabels } from "../i18n";
import type { NpcRelation, StoryNpc } from "../types";

interface Props {
  npc: StoryNpc;
  relation: NpcRelation;
  labels: CareerRpgLabels["career"];
}

export function NpcRelationCard({ npc, relation, labels }: Props) {
  const trust = relation.trustScore;
  const tone = trust >= 70 ? "strong" : trust >= 50 ? "warm" : trust >= 30 ? "cautious" : "fragile";
  const toneClass = {
    strong: "bg-[#ECFDF5] text-[#047857] ring-[#A7F3D0]",
    warm: "bg-[#EFF6FF] text-[#1D4ED8] ring-[#BFDBFE]",
    cautious: "bg-[#FEF3C7] text-[#B45309] ring-[#FDE68A]",
    fragile: "bg-[#FEE2E2] text-[#B91C1C] ring-[#FECACA]"
  }[tone];

  return (
    <Card className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <NpcAvatar avatarInitial={npc.avatarInitial} avatarTint={npc.avatarTint} />
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-sm font-semibold text-[#111827]">{npc.nameJa}</h4>
          <p className="truncate text-xs text-[#4B5563]">{npc.roleJa}</p>
          {npc.companyJa ? (
            <p className="truncate text-[11px] text-[#6B7280]">{npc.companyJa}</p>
          ) : null}
        </div>
        <span
          className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ring-1 ${toneClass}`}
        >
          {npc.defaultRelation === "uchi" ? labels.relationUchi : labels.relationSoto}
        </span>
      </div>
      <div className="space-y-1">
        <div className="flex items-baseline justify-between text-[11px] text-[#6B7280]">
          <span className="uppercase tracking-[0.16em]">{labels.trustLabel}</span>
          <span className="text-sm font-semibold text-[#111827]">{trust}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[#F1F5F9]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#1B2A4A] to-[#3B82F6] transition-[width] duration-500"
            style={{ width: `${trust}%` }}
          />
        </div>
      </div>
      <p className="text-[11px] leading-relaxed text-[#4B5563]">{npc.bioVi}</p>
    </Card>
  );
}

export function NpcAvatar({
  avatarInitial,
  avatarTint,
  size = 48
}: {
  avatarInitial: string;
  avatarTint: string;
  size?: number;
}) {
  return (
    <div
      aria-hidden
      className="grid place-items-center rounded-full text-white shadow-[inset_0_-2px_0_rgba(0,0,0,0.12)]"
      style={{
        background: avatarTint,
        height: size,
        width: size,
        fontSize: size * 0.42,
        fontWeight: 600
      }}
    >
      {avatarInitial}
    </div>
  );
}

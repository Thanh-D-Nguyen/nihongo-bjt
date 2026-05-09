"use client";

import { Button } from "@nihongo-bjt/ui";

import { findNpc } from "../mock-data";
import type { CareerRpgLabels } from "../i18n";
import type { RiskOutcomePreview } from "../types";

import { NpcAvatar } from "./npc-relation-card";

interface Props {
  outcome: RiskOutcomePreview;
  labels: CareerRpgLabels["chapter"];
  reactionLabels: CareerRpgLabels["reaction"];
  onContinue: () => void;
  continueLabel: string;
}

export function NpcReactionOverlay({
  continueLabel,
  labels,
  onContinue,
  outcome,
  reactionLabels
}: Props) {
  const npc = findNpc(outcome.affectedNpcSlug);
  const reactionText = reactionLabels[outcome.npcReactionTag];
  const accent = outcomeAccent(outcome);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#0F172A]/45 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-[0_24px_64px_-24px_rgba(15,23,42,0.4)] motion-safe:animate-[fadeInUp_280ms_ease-out]">
        <div className="flex items-start gap-4 px-6 pt-6">
          {npc ? (
            <NpcAvatar avatarInitial={npc.avatarInitial} avatarTint={npc.avatarTint} size={56} />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#6B7280]">
              {npc?.companyJa ?? ""}
            </p>
            <h3 className="text-base font-semibold text-[#111827]">{npc?.nameJa ?? "—"}</h3>
            <p className="text-xs text-[#4B5563]">
              {npc?.roleJa ?? ""} · <span className={accent.toneClass}>{reactionText}</span>
            </p>
          </div>
        </div>
        <div className="px-6 py-5">
          <p className="rounded-2xl rounded-tl-sm bg-[#F8FAFC] px-4 py-3 text-sm leading-relaxed text-[#111827] motion-safe:animate-[fadeIn_400ms_ease-out]">
            {outcome.consequenceJa}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-[#4B5563]">{outcome.consequenceVi}</p>
        </div>
        <div className="border-t border-dashed border-[#E2E8F0] bg-[#F8FAFC] px-6 py-4">
          <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-[#6B7280]">
            {labels.consequenceTitle}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <DeltaChip label={labels.politenessAxis} value={outcome.politenessScore} suffix="" />
            <DeltaChip label={labels.clarityAxis} value={outcome.clarityScore} suffix="" />
            <DeltaChip
              isDelta
              label={labels.riskAxis}
              value={outcome.businessRiskDelta}
              invertColor
            />
            <DeltaChip isDelta label={labels.satisfactionAxis} value={outcome.satisfactionDelta} />
          </div>
          <p className="mt-3 text-[11px] text-[#4B5563]">
            <span className="uppercase tracking-[0.16em] text-[#6B7280]">
              {labels.nextActionLabel}
            </span>{" "}
            <span
              className={
                outcome.nextActionCorrect ? "font-semibold text-[#047857]" : "font-semibold text-[#B91C1C]"
              }
            >
              {outcome.nextActionCorrect ? labels.nextActionYes : labels.nextActionNo}
            </span>
          </p>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4">
          <Button onClick={onContinue} size="md" variant="primary">
            {continueLabel}
          </Button>
        </div>
      </div>
      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

function DeltaChip({
  isDelta = false,
  invertColor = false,
  label,
  suffix,
  value
}: {
  isDelta?: boolean;
  invertColor?: boolean;
  label: string;
  suffix?: string;
  value: number;
}) {
  const isPositive = value > 0;
  const isNegative = value < 0;
  const colorPositive = invertColor ? "text-[#B91C1C]" : "text-[#047857]";
  const colorNegative = invertColor ? "text-[#047857]" : "text-[#B91C1C]";
  const tone = isPositive ? colorPositive : isNegative ? colorNegative : "text-[#111827]";
  const sign = isDelta && isPositive ? "+" : "";
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.16em] text-[#6B7280]">{label}</p>
      <p className={`text-sm font-semibold ${tone}`}>
        {sign}
        {value}
        {suffix ?? ""}
      </p>
    </div>
  );
}

function outcomeAccent(outcome: RiskOutcomePreview): { toneClass: string } {
  if (outcome.trustDelta >= 5) return { toneClass: "text-[#047857]" };
  if (outcome.trustDelta <= -5) return { toneClass: "text-[#B91C1C]" };
  return { toneClass: "text-[#4B5563]" };
}

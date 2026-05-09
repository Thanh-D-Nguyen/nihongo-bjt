"use client";

import { useState } from "react";
import Link from "next/link";

import { findNpc } from "../mock-data";
import type { CareerRpgLabels } from "../i18n";
import type { ChapterResult, SkillAxisCode } from "../types";

import { NpcAvatar } from "./npc-relation-card";

interface Props {
  result: ChapterResult;
  labels: CareerRpgLabels["complete"];
  axisLabels: CareerRpgLabels["career"]["skillsAxisLabels"];
  locale: string;
}

const SENTIMENT_CONFIG = {
  positive: {
    bg: "from-[#064E3B] to-[#065F46]",
    quoteBg: "bg-[#065F46]/50",
    quoteText: "text-[#A7F3D0]",
    nameBadge: "bg-[#047857]/40 text-[#6EE7B7]",
    glow: "bg-[radial-gradient(circle_at_70%_30%,rgba(16,185,129,0.18),transparent_60%)]"
  },
  neutral: {
    bg: "from-[#1E293B] to-[#334155]",
    quoteBg: "bg-[#334155]/50",
    quoteText: "text-[#CBD5E1]",
    nameBadge: "bg-[#475569]/40 text-[#94A3B8]",
    glow: "bg-[radial-gradient(circle_at_70%_30%,rgba(148,163,184,0.12),transparent_60%)]"
  },
  negative: {
    bg: "from-[#450A0A] to-[#7F1D1D]",
    quoteBg: "bg-[#7F1D1D]/50",
    quoteText: "text-[#FCA5A5]",
    nameBadge: "bg-[#991B1B]/40 text-[#FCA5A5]",
    glow: "bg-[radial-gradient(circle_at_70%_30%,rgba(239,68,68,0.18),transparent_60%)]"
  }
};

export function ChapterCompleteScreen({ axisLabels, labels, locale, result }: Props) {
  const [statsOpen, setStatsOpen] = useState(false);

  return (
    <div className="space-y-5 motion-safe:animate-[fadeIn_350ms_ease-out]">
      <header className="text-center">
        <p className="text-[11px] uppercase tracking-[0.28em] text-[#6B7280]">{labels.eyebrow}</p>
        <h1 className="mt-1 text-2xl font-bold leading-tight text-[#111827]">
          {labels.chapterClearedTitle}
        </h1>
      </header>

      <section>
        <p className="mb-3 text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF]">
          {labels.npcMontageTitle}
        </p>
        <ul className="space-y-3">
          {result.npcReactionMontage.map((reaction, idx) => {
            const npc = findNpc(reaction.npcSlug);
            if (!npc) return null;
            const cfg = SENTIMENT_CONFIG[reaction.sentiment];
            return (
              <li
                className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${cfg.bg} p-5 motion-safe:animate-[heroCardIn_380ms_ease-out_both]`}
                key={idx}
                style={{ animationDelay: `${idx * 140}ms` }}
              >
                <div className={`absolute inset-0 ${cfg.glow}`} />
                <div className="relative flex items-start gap-4">
                  <div className="shrink-0">
                    <NpcAvatar avatarInitial={npc.avatarInitial} avatarTint={npc.avatarTint} size={52} />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cfg.nameBadge}`}>
                        {npc.nameJa}
                      </span>
                      <span className="text-[11px] text-white/40">{npc.roleJa}</span>
                    </div>
                    <blockquote
                      className={`rounded-xl ${cfg.quoteBg} px-4 py-3 text-sm leading-relaxed ${cfg.quoteText} backdrop-blur-sm`}
                    >
                      「{reaction.quoteJa}」
                    </blockquote>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-2xl border border-[#E2E8F0] bg-white overflow-hidden">
        <button
          className="flex w-full items-center justify-between px-5 py-4 text-left"
          onClick={() => setStatsOpen((v) => !v)}
          type="button"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6B7280]">
            {labels.deltasTitle}
          </p>
          <span className="text-[#9CA3AF] text-xs">{statsOpen ? "▲" : "▼"}</span>
        </button>

        {statsOpen ? (
          <div className="border-t border-[#E2E8F0] px-5 pb-5 pt-4 space-y-4 motion-safe:animate-[fadeIn_200ms_ease-out]">
            <div className="grid gap-3 sm:grid-cols-3">
              <DeltaCell
                accent="#1B2A4A"
                label={labels.rankXpLabel}
                primary={`+${result.rankXpDelta}`}
                secondary="XP"
              />
              <DeltaCell
                accent="#047857"
                label={labels.skillDeltasLabel}
                primary={Object.entries(result.skillDeltas)
                  .map(([axis, v]) => `${axisLabels[axis as SkillAxisCode]} +${v}`)
                  .join(" · ")}
              />
              <DeltaCell
                accent="#9F1239"
                label={labels.memosDroppedLabel}
                primary={`+${result.contextMemoIds.length}`}
                secondary="memos"
              />
            </div>
            <div>
              <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-[#6B7280]">
                {labels.npcTrustLabel}
              </p>
              <ul className="grid gap-2 sm:grid-cols-3">
                {result.npcTrustDeltas.map((d) => {
                  const npc = findNpc(d.npcSlug);
                  if (!npc) return null;
                  const positive = d.delta >= 0;
                  return (
                    <li
                      className="flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs"
                      key={d.npcSlug}
                    >
                      <NpcAvatar avatarInitial={npc.avatarInitial} avatarTint={npc.avatarTint} size={28} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-[#111827]">{npc.nameJa}</p>
                        <p className={positive ? "text-[#047857] font-semibold" : "text-[#B91C1C] font-semibold"}>
                          {positive ? "+" : ""}{d.delta}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        ) : null}
      </section>

      <div className="flex flex-wrap justify-center gap-2 pt-1">
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-[10px] bg-[#1B2A4A] px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#243560]"
          href={`/${locale}/review-inbox-preview`}
        >
          {labels.reviewInboxCta}
        </Link>
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-[10px] border border-[#E2E8F0] bg-white px-5 text-sm font-semibold text-[#111827] shadow-sm transition-colors hover:bg-[#F8FAFC]"
          href={`/${locale}/daily-standup`}
        >
          {labels.backToStandupCta}
        </Link>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes heroCardIn {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

function DeltaCell({
  accent,
  label,
  primary,
  secondary
}: {
  accent: string;
  label: string;
  primary: string;
  secondary?: string;
}) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] px-4 py-3" style={{ borderLeftColor: accent, borderLeftWidth: 3 }}>
      <p className="text-[10px] uppercase tracking-[0.18em] text-[#6B7280]">{label}</p>
      <p className="mt-1 text-base font-bold leading-tight text-[#111827]">{primary}</p>
      {secondary ? <p className="text-[11px] text-[#9CA3AF]">{secondary}</p> : null}
    </div>
  );
}

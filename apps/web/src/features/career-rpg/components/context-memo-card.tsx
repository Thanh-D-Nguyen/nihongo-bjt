"use client";

import { findNpc } from "../mock-data";
import type { CareerRpgLabels } from "../i18n";
import type { ContextMemo } from "../types";

import { NpcAvatar } from "./npc-relation-card";

interface Props {
  memo: ContextMemo;
  labels: CareerRpgLabels["inbox"];
  onFeedback?: (verdict: "useful" | "fuzzy" | "lost") => void;
}

export function ContextMemoCard({ labels, memo, onFeedback }: Props) {
  const npc = findNpc(memo.fromNpcSlug);
  const npcName = memo.fromNpcNameJa ?? npc?.nameJa ?? memo.fromNpcSlug;
  const avatarInitial = memo.fromNpcAvatarInitial ?? npc?.avatarInitial;
  const avatarTint = memo.fromNpcAvatarTint ?? npc?.avatarTint ?? "#1B2A4A";
  const dateStr = new Date(memo.generatedAt).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-[#FFFDF7] shadow-sm ${
        memo.status === "unread"
          ? "border-[#FDE68A] ring-2 ring-[#FBBF24]/30"
          : "border-[#E8E0CC]"
      }`}
    >
      <MemoSealStamp label="社内メモ" />

      <div className="border-b border-dashed border-[#E8D5A0] bg-[#FEF9EC] px-5 py-4">
        <p className="text-[9px] uppercase tracking-[0.28em] text-[#92400E]/60">
          社内便箋 · {labels.cardKindLabels[memo.cardKind]}
        </p>
        <div className="mt-2 flex items-center gap-3">
          {avatarInitial ? (
            <NpcAvatar avatarInitial={avatarInitial} avatarTint={avatarTint} size={38} />
          ) : null}
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[10px] text-[#92400E]/70">{labels.fromLabel}:</p>
              <p className="text-sm font-bold text-[#78350F]">{npcName}</p>
            </div>
            <p className="text-[10px] text-[#92400E]/60">{dateStr}</p>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-5 py-5">
        <div className="text-center py-2">
          <p className="font-serif text-2xl font-semibold tracking-wide text-[#1C1917]">
            {memo.expressionJa}
          </p>
          <p className="mt-0.5 text-sm text-[#78716C]">{memo.reading}</p>
          <p className="mt-1.5 text-xs text-[#57534E]">{memo.surfaceMeaningVi}</p>
        </div>

        <div className="rounded-xl border border-dashed border-[#D4B483] bg-[#FEF3C7]/60 px-4 py-3">
          <p className="text-[9px] uppercase tracking-[0.2em] text-[#92400E]">
            {labels.realIntentLabel}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-[#1C1917]">{memo.realIntentVi}</p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 text-xs">
          <MemoField label={labels.sceneLabel} value={memo.sceneJa} />
          <MemoField label={labels.toneLabel} value={memo.toneVi} />
        </div>

        <div className="rounded-xl border border-[#FCA5A5]/50 bg-[#FFF5F5] px-4 py-3">
          <p className="text-[9px] uppercase tracking-[0.2em] text-[#9F1239]">
            {labels.bjtTrapLabel}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-[#7F1D1D]">{memo.bjtTrapVi}</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-[#E8D5A0] pt-4">
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide ${
              memo.status === "unread"
                ? "bg-[#9F1239] text-white"
                : "bg-[#E8D5A0] text-[#78350F]"
            }`}
          >
            {memo.status === "unread" ? labels.statusUnread : labels.statusRead}
          </span>
          {onFeedback ? (
            <div className="flex gap-2">
              <MemoActionButton
                onClick={() => onFeedback("useful")}
                variant="primary"
              >
                {labels.markReadCta}
              </MemoActionButton>
              <MemoActionButton
                onClick={() => onFeedback("fuzzy")}
                variant="secondary"
              >
                {labels.reviewCompleteCta}
              </MemoActionButton>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MemoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#FEF9EC] border border-[#E8D5A0] px-3 py-2">
      <p className="text-[9px] uppercase tracking-[0.18em] text-[#92400E]/70">{label}</p>
      <p className="mt-0.5 text-xs text-[#1C1917]">{value}</p>
    </div>
  );
}

function MemoActionButton({
  children,
  onClick,
  variant
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant: "primary" | "secondary";
}) {
  return (
    <button
      className={`min-h-8 rounded-lg border px-3 text-[11px] font-semibold transition-colors ${
        variant === "primary"
          ? "border-[#9F1239]/30 bg-[#FFF5F5] text-[#9F1239] hover:bg-[#FEE2E2]"
          : "border-[#E8D5A0] bg-[#FEF9EC] text-[#78350F] hover:bg-[#FEF3C7]"
      }`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function MemoSealStamp({ label }: { label: string }) {
  return (
    <div className="absolute right-4 top-4 flex h-12 w-12 rotate-12 items-center justify-center rounded-full border-2 border-[#9F1239]/70 opacity-70">
      <div className="flex flex-col items-center">
        {label.split("").map((ch, i) => (
          <span className="text-[7px] font-bold leading-none text-[#9F1239]" key={i}>
            {ch}
          </span>
        ))}
      </div>
    </div>
  );
}

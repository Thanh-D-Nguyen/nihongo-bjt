"use client";

import { useState } from "react";

import type { CareerRpgLabels } from "../i18n";
import type { ContextMemo } from "../types";

import { ContextMemoCard } from "./context-memo-card";

interface Props {
  inbox: ContextMemo[];
  labels: CareerRpgLabels["inbox"];
}

export function ReviewInboxPreview({ inbox, labels }: Props) {
  const [openId, setOpenId] = useState<string | null>(inbox[0]?.id ?? null);

  if (inbox.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#E2E8F0] bg-white p-8 text-center text-sm text-[#6B7280]">
        —
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
      <ul className="space-y-2">
        {inbox.map((memo) => {
          const isOpen = memo.id === openId;
          return (
            <li key={memo.id}>
              <button
                className={`w-full rounded-xl border px-4 py-3 text-left transition-all ${
                  isOpen
                    ? "border-[#1B2A4A] bg-[#EEF2FF] shadow-sm"
                    : "border-[#E2E8F0] bg-white hover:border-[#CBD5E1] hover:bg-[#F8FAFC]"
                }`}
                onClick={() => setOpenId(memo.id)}
                type="button"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-[#6B7280]">
                    {labels.cardKindLabels[memo.cardKind]}
                  </span>
                  {memo.status === "unread" ? (
                    <span className="h-2 w-2 rounded-full bg-[#9F1239]" />
                  ) : null}
                </div>
                <p className="mt-1 truncate text-sm font-semibold text-[#111827]">
                  {memo.expressionJa}
                </p>
                <p className="line-clamp-2 text-xs text-[#4B5563]">{memo.realIntentVi}</p>
              </button>
            </li>
          );
        })}
      </ul>
      <div>
        {openId ? (
          <ContextMemoCard
            labels={labels}
            memo={inbox.find((m) => m.id === openId) ?? inbox[0]}
            onFeedback={() => {
              /* prototype no-op */
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useState } from "react";

import { updateCareerProfile } from "../api";
import type { UserCareerState } from "../types";

const DEFAULT_JP_WORK_NAME = "田中 太郎";

const SUGGESTED_NAMES = [
  { surname: "佐藤", given: "ゆうき", full: "佐藤 ゆうき" },
  { surname: "鈴木", given: "あおい", full: "鈴木 あおい" },
  { surname: "高橋", given: "はると", full: "高橋 はると" },
  { surname: "中村", given: "みなみ", full: "中村 みなみ" },
  { surname: "山本", given: "りく", full: "山本 りく" },
  { surname: "田中", given: "さくら", full: "田中 さくら" },
];

export interface CareerNameOnboardingLabels {
  title: string;
  explanation: string;
  explanationDetail: string;
  nameLabel: string;
  namePlaceholder: string;
  suggestionsLabel: string;
  confirmCta: string;
  skipCta: string;
  saving: string;
  error: string;
}

interface Props {
  labels: CareerNameOnboardingLabels;
  onComplete: (updatedState: UserCareerState) => void;
}

export function needsNameOnboarding(career: UserCareerState): boolean {
  return career.jpWorkName === DEFAULT_JP_WORK_NAME;
}

export function CareerNameOnboarding({ labels, onComplete }: Props) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      const response = await updateCareerProfile({ jpWorkName: trimmed });
      onComplete(response.state);
    } catch {
      setError(labels.error);
      setSaving(false);
    }
  }, [labels.error, name, onComplete]);

  const handleSkip = useCallback(() => {
    // Keep default name — just dismiss
    onComplete(null as unknown as UserCareerState);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white shadow-2xl">
        {/* Header */}
        <div className="rounded-t-2xl bg-gradient-to-br from-[#0F172A] via-[#1B2A4A] to-[#243560] px-6 py-5 text-white">
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/60">Career RPG</p>
          <h2 className="mt-1 text-lg font-semibold">{labels.title}</h2>
        </div>

        <div className="space-y-5 px-6 py-5">
          {/* Explanation */}
          <div className="rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] p-4">
            <p className="text-sm leading-relaxed text-[#1E40AF]">{labels.explanation}</p>
            <p className="mt-2 text-xs leading-relaxed text-[#3B82F6]">{labels.explanationDetail}</p>
          </div>

          {/* Name input */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#374151]" htmlFor="jp-work-name">
              {labels.nameLabel}
            </label>
            <input
              autoFocus
              className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2.5 text-sm text-[#111827] outline-none transition-colors placeholder:text-[#9CA3AF] focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
              id="jp-work-name"
              maxLength={30}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) void handleSubmit(); }}
              placeholder={labels.namePlaceholder}
              type="text"
              value={name}
            />
          </div>

          {/* Suggestions */}
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[#6B7280]">
              {labels.suggestionsLabel}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_NAMES.map((s) => (
                <button
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    name === s.full
                      ? "border-[#3B82F6] bg-[#EFF6FF] font-semibold text-[#1D4ED8]"
                      : "border-[#E5E7EB] bg-white text-[#374151] hover:border-[#9CA3AF] hover:bg-[#F9FAFB]"
                  }`}
                  key={s.full}
                  onClick={() => setName(s.full)}
                  type="button"
                >
                  {s.full}
                </button>
              ))}
            </div>
          </div>

          {error ? (
            <p className="text-xs text-red-600">{error}</p>
          ) : null}

          {/* Actions */}
          <div className="flex items-center justify-between gap-3 border-t border-[#F3F4F6] pt-4">
            <button
              className="text-xs font-medium text-[#6B7280] transition-colors hover:text-[#374151]"
              onClick={handleSkip}
              type="button"
            >
              {labels.skipCta}
            </button>
            <button
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#1B2A4A] px-5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#0F172A] disabled:opacity-50"
              disabled={!name.trim() || saving}
              onClick={() => void handleSubmit()}
              type="button"
            >
              {saving ? labels.saving : labels.confirmCta}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

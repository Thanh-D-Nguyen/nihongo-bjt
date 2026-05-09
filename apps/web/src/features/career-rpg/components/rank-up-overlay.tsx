"use client";

import type { CareerRank } from "../types";
import type { CareerRpgLabels } from "../i18n";

interface Props {
  oldRank: CareerRank;
  newRank: CareerRank;
  labels: CareerRpgLabels["rankUp"];
  onContinue: () => void;
}

const SCENE_LABEL: Record<string, string> = {
  email: "メール",
  chat: "チャット",
  deadline: "締め切り",
  meeting: "会議",
  complaint: "クレーム",
  report_chart: "報告・図表"
};

export function RankUpOverlay({ labels, newRank, oldRank, onContinue }: Props) {
  const newlyUnlocked = newRank.unlockedSceneTypes.filter(
    (s) => !oldRank.unlockedSceneTypes.includes(s)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-[#050D1F]/90 backdrop-blur-sm" />

      <div
        className="relative mx-4 mb-4 w-full max-w-sm sm:mb-0 motion-safe:animate-[rankUpSlide_420ms_cubic-bezier(0.22,1,0.36,1)_both]"
      >
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0F172A] shadow-2xl shadow-[#9F1239]/20">
          <div className="relative bg-gradient-to-br from-[#1B2A4A] via-[#243560] to-[#0F172A] px-7 pt-8 pb-6">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(159,18,57,0.25),transparent_65%)]" />
            <div className="relative">
              <p className="text-[11px] uppercase tracking-[0.28em] text-white/50">
                {labels.eyebrow}
              </p>
              <div className="mt-3 flex items-center justify-between">
                <SealStamp label={labels.sealStamp} />
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                    {labels.oldRankLabel}
                  </p>
                  <p className="text-sm text-white/60 line-through">{oldRank.titleJa}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="px-7 py-6 space-y-5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF]">
                {labels.newRankLabel}
              </p>
              <p className="mt-1 text-3xl font-bold tracking-tight text-white">
                {newRank.titleJa}
              </p>
              <p className="text-sm text-[#94A3B8]">{newRank.titleVi}</p>
              <p className="mt-1 text-[11px] text-[#F59E0B]">BJT目標: {newRank.bjtBandTarget}</p>
            </div>

            {newlyUnlocked.length > 0 ? (
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-[#9CA3AF]">
                  {labels.unlocksTitle}
                </p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {newlyUnlocked.map((s) => (
                    <li
                      className="rounded-full border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#FDE68A]"
                      key={s}
                    >
                      {SCENE_LABEL[s] ?? s}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <button
              className="w-full min-h-12 rounded-[10px] bg-[#9F1239] text-sm font-semibold text-white shadow-lg shadow-[#9F1239]/30 transition-all hover:bg-[#B91C1C] active:scale-[0.98]"
              onClick={onContinue}
              type="button"
            >
              {labels.continueCta}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes rankUpSlide {
          from {
            opacity: 0;
            transform: translateY(40px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}

function SealStamp({ label }: { label: string }) {
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#9F1239] bg-[#9F1239]/15 motion-safe:animate-[sealPop_500ms_300ms_cubic-bezier(0.34,1.56,0.64,1)_both]">
      <div className="flex flex-col items-center gap-0.5">
        {label.split("").map((ch, i) => (
          <span className="text-[10px] font-bold leading-none tracking-wider text-[#F87171]" key={i}>
            {ch}
          </span>
        ))}
      </div>
      <style jsx>{`
        @keyframes sealPop {
          from {
            opacity: 0;
            transform: scale(0.4) rotate(-12deg);
          }
          to {
            opacity: 1;
            transform: scale(1) rotate(0deg);
          }
        }
      `}</style>
    </div>
  );
}

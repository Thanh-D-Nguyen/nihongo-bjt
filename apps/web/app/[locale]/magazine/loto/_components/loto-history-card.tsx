"use client";

import { useState } from "react";

type LotoGame = "loto6" | "loto7";

interface FeedItem {
  id: string;
  drawNumber: number | null;
  drawDate: string;
  drawDayJp?: string;
  drawTime?: string;
  game: LotoGame;
  sets: Array<{ mainNumbers: number[]; bonusNumbers: number[]; score: number }>;
  result: { mainNumbers: number[]; bonusNumbers: number[] } | null;
  hitCount: number;
  bonusHit: boolean;
  jpSentence: { textJp: string; reading: string; textVi: string; vocabItems: Array<{ wordJp: string; reading: string; meaningVi: string }> } | null;
}

interface Labels {
  prediction?: string;
  result?: string;
  hitCount?: string;
  pending?: string;
  viewDetail?: string;
  vocab?: string;
  drawNumber?: string;
}

function HitDots({ predicted, actual }: { predicted: number[]; actual: number[] }) {
  const actualSet = new Set(actual);
  return (
    <div className="flex items-center gap-1">
      {predicted.map((num, i) => {
        const hit = actualSet.has(num);
        return (
          <span
            key={i}
            className={`flex size-5 items-center justify-center rounded-full text-[10px] font-bold ${
              hit ? "bg-green-500 text-white" : "bg-border/40 text-muted"
            }`}
            title={String(num)}
          >
            {hit ? "●" : "○"}
          </span>
        );
      })}
    </div>
  );
}

function hitColorClass(hitCount: number, total: number): string {
  const ratio = hitCount / total;
  if (ratio >= 0.6) return "text-green-600 bg-green-500/10";
  if (ratio >= 0.3) return "text-amber-600 bg-amber-500/10";
  return "text-muted bg-border/20";
}

export function LotoHistoryCard({ item, labels, game }: { item: FeedItem; labels: Labels; game: LotoGame }) {
  const [expanded, setExpanded] = useState(false);
  const primarySet = item.sets[0];
  const totalNumbers = game === "loto6" ? 6 : 7;

  return (
    <div className="overflow-hidden rounded-2xl border border-border/30 bg-surface/60 shadow-sm transition-all duration-200 hover:shadow-md">
      {/* Card header */}
      <div className="flex items-center justify-between border-b border-border/20 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
            {item.drawNumber ? `#${item.drawNumber}` : item.drawDate}
          </span>
          <span className="text-xs text-muted">
            {item.drawDate}{item.drawDayJp ? `（${item.drawDayJp}）` : ""}
          </span>
          {item.drawTime && (
            <span className="text-[10px] text-muted/70">{item.drawTime}</span>
          )}
        </div>
        {item.result ? (
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${hitColorClass(item.hitCount, totalNumbers)}`}>
            {(labels.hitCount ?? "Trúng {hit}/{total}")
              .replace("{hit}", String(item.hitCount))
              .replace("{total}", String(totalNumbers))}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-border/20 px-2.5 py-1 text-xs text-muted">
            <span className="inline-block size-1.5 animate-pulse rounded-full bg-amber-400" />
            {labels.pending ?? "Chờ kết quả"}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="space-y-3 p-4">
        {/* Prediction row */}
        {primarySet && (
          <div>
            <span className="text-xs font-medium text-muted">{labels.prediction ?? "Dự đoán"}:</span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {primarySet.mainNumbers.map((num, i) => {
                const isHit = item.result ? new Set(item.result.mainNumbers).has(num) : false;
                return (
                  <span
                    key={i}
                    className={`flex size-8 items-center justify-center rounded-full text-xs font-bold ${
                      isHit
                        ? "bg-green-500 text-white ring-2 ring-green-400/30"
                        : "bg-border/30 text-ink/70"
                    }`}
                  >
                    {num}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Result row */}
        {item.result && (
          <div>
            <span className="text-xs font-medium text-muted">{labels.result ?? "Kết quả"}:</span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {item.result.mainNumbers.map((num, i) => (
                <span
                  key={i}
                  className="flex size-8 items-center justify-center rounded-full bg-ink/10 text-xs font-bold text-ink"
                >
                  {num}
                </span>
              ))}
              {item.result.bonusNumbers.map((num, i) => (
                <span
                  key={`b${i}`}
                  className="flex size-7 items-center justify-center rounded-full border border-muted/40 text-xs text-muted"
                >
                  {num}
                </span>
              ))}
            </div>
            {primarySet && (
              <div className="mt-2">
                <HitDots predicted={primarySet.mainNumbers} actual={item.result.mainNumbers} />
              </div>
            )}
          </div>
        )}

        {/* JP sentence (collapsed for history) */}
        {item.jpSentence && (
          <div className={`${expanded ? "" : "line-clamp-2"} rounded-xl bg-white/40 p-3 dark:bg-white/5`}>
            <p className="text-sm font-medium leading-[1.8] text-ink">
              「{item.jpSentence.textJp}」
            </p>
            {expanded && (
              <>
                <p className="mt-0.5 text-xs leading-[1.8] text-muted">
                  ({item.jpSentence.reading})
                </p>
                <p className="mt-0.5 text-xs text-ink/70">
                  → {item.jpSentence.textVi}
                </p>
                {item.jpSentence.vocabItems.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="text-xs text-muted">📚</span>
                    {item.jpSentence.vocabItems.map((v, i) => (
                      <span key={i} className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary">
                        {v.wordJp}({v.reading})
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Expand toggle */}
        {item.jpSentence && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex min-h-10 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-primary transition-all duration-150 hover:bg-primary/10 active:scale-95"
          >
            {expanded ? "Thu gọn ↑" : (labels.viewDetail ?? "Xem chi tiết") + " ↓"}
          </button>
        )}
      </div>
    </div>
  );
}

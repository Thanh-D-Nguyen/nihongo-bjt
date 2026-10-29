"use client";

import { useState } from "react";

import { LotoBall, LotoBonusBall } from "./loto-balls";
import type { LotoFeedItem, LotoGame, LotoLabels } from "./loto-types";

function fill(
  template: string | undefined,
  fallback: string,
  values: Record<string, string | number>
) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    template ?? fallback
  );
}

function hitColorClass(hitCount: number, total: number): string {
  const ratio = hitCount / total;
  if (ratio >= 0.6) return "text-green-600 bg-green-500/10";
  if (ratio >= 0.3) return "text-amber-600 bg-amber-500/10";
  return "text-muted bg-border/20";
}

function KindBadge({ kind, labels }: { kind: LotoFeedItem["kind"]; labels: LotoLabels }) {
  if (kind === "backtest") {
    return (
      <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:text-violet-300">
        {labels.kindBacktest ?? "Tính lại (backtest)"}
      </span>
    );
  }
  if (kind === "published") {
    return (
      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
        {labels.kindPublished ?? "Đã công bố"}
      </span>
    );
  }
  return null;
}

export function LotoHistoryCard({
  item,
  labels,
  game
}: {
  item: LotoFeedItem;
  labels: LotoLabels;
  game: LotoGame;
}) {
  const [expanded, setExpanded] = useState(false);
  const primarySet = item.sets[0];
  const totalNumbers = game === "loto6" ? 6 : 7;
  const resultMain = item.result ? new Set(item.result.mainNumbers) : null;

  return (
    <article className="overflow-hidden rounded-2xl border border-border/30 bg-surface/60 shadow-sm transition-all duration-200 hover:shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/20 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-primary/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-primary">
            {item.drawNumber ? `#${item.drawNumber}` : item.drawDate}
          </span>
          <span className="text-xs text-muted">
            {item.drawDate}
            {item.drawDayJp ? `（${item.drawDayJp}）` : ""}
          </span>
          <KindBadge kind={item.kind} labels={labels} />
        </div>
        {primarySet &&
          (item.result ? (
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${hitColorClass(item.hitCount, totalNumbers)}`}
            >
              {fill(labels.hitCount, "Khớp {hit}/{total} số", {
                hit: item.hitCount,
                total: totalNumbers
              })}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-border/20 px-2.5 py-1 text-xs text-muted">
              <span className="inline-block size-1.5 animate-pulse rounded-full bg-amber-400" />
              {labels.pending ?? "Chờ kết quả"}
            </span>
          ))}
        {!primarySet && (
          <span className="rounded-full bg-border/20 px-2.5 py-1 text-[10px] font-semibold text-muted">
            {labels.kindResult ?? "Kết quả chính thức"}
          </span>
        )}
      </div>

      <div className="space-y-3 p-4">
        {primarySet && (
          <div>
            <span className="text-xs font-medium text-muted">
              {labels.prediction ?? "Tổ hợp tham khảo"}:
            </span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {primarySet.mainNumbers.map((num) => (
                <LotoBall
                  key={num}
                  value={num}
                  game={game}
                  size="md"
                  state={resultMain ? (resultMain.has(num) ? "hit" : "miss") : "miss"}
                />
              ))}
            </div>
          </div>
        )}

        {item.result && (
          <div>
            <span className="text-xs font-medium text-muted">{labels.result ?? "Kết quả"}:</span>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {item.result.mainNumbers.map((num) => (
                <LotoBall key={num} value={num} game={game} size="md" state="result" />
              ))}
              {item.result.bonusNumbers.map((num) => (
                <LotoBonusBall key={`b${num}`} value={num} size="sm" />
              ))}
            </div>
            {item.bonusHit && (
              <p className="mt-2 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                ★ {labels.bonusMatched ?? "Trùng số bonus"}
              </p>
            )}
          </div>
        )}

        {item.jpSentence && (
          <div
            className={`${expanded ? "" : "line-clamp-2"} rounded-xl bg-white/40 p-3 dark:bg-white/5`}
          >
            <p className="text-sm font-medium leading-[1.8] text-ink">
              「{item.jpSentence.textJp}」
            </p>
            {expanded && (
              <>
                <p className="mt-0.5 text-xs leading-[1.8] text-muted">
                  （{item.jpSentence.reading}）
                </p>
                <p className="mt-0.5 text-xs text-ink/70">→ {item.jpSentence.textVi}</p>
                {item.jpSentence.grammar && (
                  <p className="mt-1.5 text-[11px] text-ink/70">
                    <span className="font-semibold text-primary">
                      {labels.grammar ?? "Ngữ pháp"}:
                    </span>{" "}
                    {item.jpSentence.grammar}
                  </p>
                )}
                {item.jpSentence.vocabItems.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {item.jpSentence.vocabItems.map((v) => (
                      <li
                        key={`${v.wordJp}-${v.reading}`}
                        className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary"
                      >
                        {v.wordJp}（{v.reading}）· {v.meaningVi}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        )}

        {item.jpSentence && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            className="flex min-h-10 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-primary transition-all duration-150 hover:bg-primary/10 active:scale-95"
          >
            {expanded
              ? `${labels.collapse ?? "Thu gọn"} ↑`
              : `${labels.viewDetail ?? "Xem chi tiết"} ↓`}
          </button>
        )}
      </div>
    </article>
  );
}

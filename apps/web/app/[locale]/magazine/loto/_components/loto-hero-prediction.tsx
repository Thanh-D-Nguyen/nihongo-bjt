"use client";

import { useState } from "react";

import { LotoBall, LotoBonusBall } from "./loto-balls";
import type { LotoGame, LotoLabels, LotoNextDraw, LotoVocabItem } from "./loto-types";

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

function Countdown({ days, labels }: { days: number; labels: LotoLabels }) {
  if (days > 3) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
      🗓{" "}
      {days <= 0
        ? (labels.today ?? "hôm nay")
        : fill(labels.countdown, "còn {days} ngày", { days })}
    </span>
  );
}

function ConfidenceMeter({ value, labels }: { value: number; labels: LotoLabels }) {
  const percent = Math.round(Math.min(Math.max(value, 0), 1) * 100);
  return (
    <div className="rounded-xl border border-border/30 bg-white/40 px-3 py-2.5 dark:bg-white/5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-ink/70">
          {labels.confidence ?? "Điểm xếp hạng mô hình"}
        </span>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold tabular-nums text-primary">
          {value.toFixed(2)}
        </span>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-border/20"
        role="presentation"
        aria-hidden="true"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
        {labels.confidenceHint ?? "Chỉ dùng để xếp hạng heuristic, không phải xác suất trúng."}
      </p>
    </div>
  );
}

function VocabGrid({ items, labels }: { items: LotoVocabItem[]; labels: LotoLabels }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted">📚 {labels.vocab ?? "Từ vựng"}</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <li
            key={`${item.wordJp}-${item.reading}`}
            className="rounded-xl bg-primary/5 px-3 py-2 ring-1 ring-primary/10"
          >
            <p className="text-sm font-semibold leading-[1.8] text-primary">
              {item.wordJp}
              <span className="ml-1.5 text-xs font-normal text-muted">（{item.reading}）</span>
            </p>
            <p className="text-xs text-ink/70">{item.meaningVi}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LotoHeroPrediction({
  data,
  labels,
  game,
  locale = "vi"
}: {
  data: LotoNextDraw;
  labels: LotoLabels;
  game: LotoGame;
  locale?: string;
}) {
  const [showReading, setShowReading] = useState(true);
  const gradientClass =
    game === "loto6"
      ? "from-emerald-500/15 via-emerald-400/5 to-transparent"
      : "from-cyan-500/15 via-cyan-400/5 to-transparent";
  const borderClass = game === "loto6" ? "ring-emerald-500/20" : "ring-cyan-500/20";
  const sentence = data.jpSentence;
  const vocab = sentence?.vocabItems?.length ? sentence.vocabItems : (data.vocabItems ?? []);

  return (
    <div
      className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${gradientClass} p-5 ring-1 ${borderClass} sm:p-6`}
    >
      <div className="absolute -right-10 -top-10 size-40 rounded-full bg-gradient-to-br from-primary/10 to-transparent blur-3xl" />

      <div className="relative space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span aria-hidden="true" className="text-lg">
              ⚡
            </span>
            <span className="text-sm font-semibold text-ink/80">
              {labels.nextDraw ?? "Tổ hợp tham khảo kỳ tiếp theo"}
            </span>
            {data.drawNumber != null && (
              <span
                className="rounded-lg bg-primary/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-primary"
                title={
                  data.drawNumberEstimated
                    ? (labels.estimatedNumber ?? "số kỳ ước tính")
                    : undefined
                }
              >
                #{data.drawNumber}
                {data.drawNumberEstimated ? "≈" : ""}
              </span>
            )}
          </div>
          <Countdown days={data.daysUntil} labels={labels} />
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-sm font-medium text-ink/80">
            📅 {data.drawDate}
            {data.drawDayJp ? `（${data.drawDayJp}）` : ""}
          </p>
          {data.drawTime && (
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              ⏰ {data.drawTime}
            </span>
          )}
        </div>
        {data.scheduleJp && (
          <div className="rounded-lg bg-white/40 px-3 py-1.5 dark:bg-white/5">
            <p className="text-xs font-medium text-ink/70">{data.scheduleJp}</p>
            {locale !== "ja" && (
              <p className="text-[11px] text-muted">
                {locale === "en" ? (data.scheduleEn ?? data.scheduleVi) : data.scheduleVi}
              </p>
            )}
          </div>
        )}

        <div className="space-y-3">
          {data.sets.slice(0, 3).map((set, i) => (
            <div key={i} className="space-y-1">
              <span className="text-xs font-medium text-muted">
                {fill(labels.set, "Bộ {n}", { n: i + 1 })}
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {set.mainNumbers.map((num) => (
                  <LotoBall key={num} value={num} game={game} size="lg" />
                ))}
                {set.bonusNumbers.length > 0 && (
                  <>
                    <span className="mx-1 text-xs text-muted">+</span>
                    {set.bonusNumbers.map((num) => (
                      <LotoBonusBall key={`b${num}`} value={num} size="md" />
                    ))}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {data.confidence != null && <ConfidenceMeter value={data.confidence} labels={labels} />}

        {sentence && (
          <div className="rounded-2xl bg-white/50 p-4 dark:bg-white/5">
            <div className="flex items-start justify-between gap-3">
              <p className="text-base font-medium leading-[1.8] text-ink">📝 {sentence.textJp}</p>
              {sentence.level && (
                <span className="shrink-0 rounded-md bg-ink/10 px-1.5 py-0.5 text-[10px] font-bold text-ink/70">
                  {sentence.level}
                </span>
              )}
            </div>
            {showReading && (
              <p className="mt-1 text-sm leading-[1.8] text-muted">（{sentence.reading}）</p>
            )}
            <p className="mt-1 text-sm text-ink/70">→ {sentence.textVi}</p>
            {sentence.grammar && (
              <p className="mt-2 rounded-lg bg-primary/5 px-2.5 py-1.5 text-xs text-ink/70">
                <span className="font-semibold text-primary">{labels.grammar ?? "Ngữ pháp"}:</span>{" "}
                {sentence.grammar}
              </p>
            )}
            <button
              type="button"
              onClick={() => setShowReading((value) => !value)}
              aria-pressed={showReading}
              className="mt-2 min-h-10 rounded-lg px-2 text-xs font-medium text-primary transition hover:bg-primary/10"
            >
              {showReading
                ? (labels.hideReading ?? "Ẩn cách đọc")
                : (labels.showReading ?? "Hiện cách đọc")}
            </button>
          </div>
        )}

        <VocabGrid items={vocab} labels={labels} />
      </div>
    </div>
  );
}

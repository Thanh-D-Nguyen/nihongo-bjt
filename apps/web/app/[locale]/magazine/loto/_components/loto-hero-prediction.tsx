"use client";

type LotoGame = "loto6" | "loto7";

interface NextDrawData {
  drawNumber: number | null;
  drawDate: string;
  sets: Array<{ mainNumbers: number[]; bonusNumbers: number[]; score: number }>;
  jpSentence: { textJp: string; reading: string; textVi: string; vocabItems: Array<{ wordJp: string; reading: string; meaningVi: string }> } | null;
  vocabItems: Array<{ wordJp: string; reading: string; meaningVi: string }>;
  confidence: number | null;
  daysUntil: number;
}

interface Labels {
  nextDraw?: string;
  drawNumber?: string;
  countdown?: string;
  confidence?: string;
  set?: string;
  bonus?: string;
  vocab?: string;
}

export function LotoHeroPrediction({ data, labels, game }: { data: NextDrawData; labels: Labels; game: LotoGame }) {
  const gradientClass = game === "loto6"
    ? "from-emerald-500/15 via-emerald-400/5 to-transparent"
    : "from-cyan-500/15 via-cyan-400/5 to-transparent";

  const borderClass = game === "loto6" ? "ring-emerald-500/20" : "ring-cyan-500/20";
  const pillBg = game === "loto6" ? "bg-emerald-500" : "bg-cyan-500";

  return (
    <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${gradientClass} p-5 ring-1 ${borderClass} sm:p-6`}>
      {/* Decorative blur */}
      <div className="absolute -right-10 -top-10 size-40 rounded-full bg-gradient-to-br from-primary/10 to-transparent blur-3xl" />

      <div className="relative space-y-4">
        {/* Header row */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚡</span>
            <span className="text-sm font-semibold text-ink/80">
              {labels.nextDraw ?? "Dự đoán kỳ tiếp theo"}
              {data.drawNumber && ` #${data.drawNumber}`}
            </span>
          </div>
          {data.daysUntil <= 3 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-700">
              🗓 {(labels.countdown ?? "còn {days} ngày").replace("{days}", String(data.daysUntil))}
            </span>
          )}
        </div>

        {/* Draw date */}
        <p className="text-xs text-muted">{data.drawDate}</p>

        {/* Number sets */}
        <div className="space-y-3">
          {data.sets.slice(0, 3).map((set, i) => (
            <div key={i} className="space-y-1">
              <span className="text-xs font-medium text-muted">
                {(labels.set ?? "Bộ {n}").replace("{n}", String(i + 1))}
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {set.mainNumbers.map((num, j) => (
                  <span
                    key={j}
                    className={`flex size-10 items-center justify-center rounded-full ${pillBg} text-sm font-bold text-white shadow-md sm:size-12 sm:text-base`}
                  >
                    {num}
                  </span>
                ))}
                {set.bonusNumbers.length > 0 && (
                  <>
                    <span className="mx-1 text-xs text-muted">+</span>
                    {set.bonusNumbers.map((num, j) => (
                      <span
                        key={`b${j}`}
                        className="flex size-9 items-center justify-center rounded-full border-2 border-current text-sm font-bold text-muted sm:size-10"
                      >
                        {num}
                      </span>
                    ))}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Confidence */}
        {data.confidence != null && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">{labels.confidence ?? "Độ tin cậy"}:</span>
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <span key={star} className={`text-sm ${data.confidence! >= star * 0.2 ? "text-amber-400" : "text-border"}`}>
                  ★
                </span>
              ))}
            </div>
            <span className="text-xs text-muted">({data.confidence.toFixed(2)})</span>
          </div>
        )}

        {/* Japanese sentence */}
        {data.jpSentence && (
          <div className="rounded-2xl bg-white/50 p-4 dark:bg-white/5">
            <p className="text-base font-medium leading-[1.8] text-ink">
              📝 {data.jpSentence.textJp}
            </p>
            <p className="mt-1 text-sm leading-[1.8] text-muted">
              ({data.jpSentence.reading})
            </p>
            <p className="mt-1 text-sm text-ink/70">
              → {data.jpSentence.textVi}
            </p>
          </div>
        )}

        {/* Vocab */}
        {(data.jpSentence?.vocabItems ?? data.vocabItems)?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-muted">📚</span>
            {(data.jpSentence?.vocabItems ?? data.vocabItems).map((v, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-xs font-medium text-primary"
              >
                {v.wordJp}({v.reading})
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

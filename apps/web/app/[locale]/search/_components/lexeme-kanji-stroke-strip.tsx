"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { cn } from "@nihongo-bjt/ui";

import type { KanjiDetailDto } from "./kanji-detail-dto";
import { fetchKanjiByCharacter, isSingleKanjiCharacter } from "./kanji-stroke-fetcher";
import {
  IconReplayStroke,
  KanjiStrokeAnimation,
  type KanjiStrokeAnimationLabels,
  usePrefersReducedMotion
} from "./kanji-stroke-animation";

type Row =
  | { status: "loading"; ch: string }
  | { status: "empty"; ch: string }
  | { status: "ok"; ch: string; dto: KanjiDetailDto };

export function LexemeKanjiStrokeStrip({
  headwordOrderChars,
  labels
}: {
  headwordOrderChars: string[];
  labels: KanjiStrokeAnimationLabels;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const [rows, setRows] = useState<Row[]>(() => headwordOrderChars.map((ch) => ({ status: "loading", ch })));
  const [step, setStep] = useState(0);
  const [orchestratorReplay, setOrchestratorReplay] = useState(0);

  const headKey = useMemo(() => headwordOrderChars.join("\u0001"), [headwordOrderChars]);

  useEffect(() => {
    let cancelled = false;
    setRows(headwordOrderChars.map((ch) => ({ status: "loading", ch })));
    setStep(0);

    void (async () => {
      const next: Row[] = [];
      for (const ch of headwordOrderChars) {
        if (!isSingleKanjiCharacter(ch)) {
          next.push({ status: "empty", ch });
          continue;
        }

        const lookup = await fetchKanjiByCharacter(ch);
        if (lookup.status === "ok") {
          next.push({ status: "ok", ch, dto: lookup.dto });
          continue;
        }

        next.push({ status: "empty", ch });
      }
      if (!cancelled) setRows(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [headKey, headwordOrderChars]);

  const playable = useMemo(() => {
    const idx: number[] = [];
    rows.forEach((r, i) => {
      if (r.status === "ok" && r.dto.strokeSvgPath?.trim()) idx.push(i);
    });
    return idx;
  }, [rows]);

  const playKey = useMemo(() => playable.join(","), [playable]);

  useEffect(() => {
    setStep(0);
  }, [playKey]);

  const handleAdvance = useCallback(() => {
    setStep((s) => Math.min(s + 1, Math.max(0, playable.length)));
  }, [playable.length]);

  const replay = () => {
    setStep(0);
    setOrchestratorReplay((n) => n + 1);
  };

  if (headwordOrderChars.length === 0) return null;

  const hasAnyStroke = playable.length > 0;
  const activeRowIndex = step < playable.length ? playable[step]! : -1;

  return (
    <section className="mb-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted">{labels.sectionTitle}</h3>
        {hasAnyStroke && !reducedMotion ? (
          <button
            aria-label={labels.replay}
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-ink/12 bg-paper text-ink/80 hover:bg-ink/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
            onClick={replay}
            title={labels.replay}
            type="button"
          >
            <IconReplayStroke />
          </button>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap items-start justify-center gap-3 rounded-xl border border-ink/10 bg-paper/50 px-2 py-3">
        {rows.map((row, i) => {
          const chainSlot = reducedMotion
            ? "solo"
            : !hasAnyStroke
              ? "solo"
              : !playable.includes(i)
                ? "solo"
                : playable.indexOf(i) < step
                  ? "complete"
                  : i === activeRowIndex
                    ? "active"
                    : "pending";

          if (row.status === "loading") {
            return (
              <div
                key={`${row.ch}-${i}-load`}
                className="flex min-h-[6rem] min-w-[120px] flex-1 max-w-[220px] items-center justify-center rounded-lg border border-ink/10 bg-surface/60 text-xs text-muted"
              >
                …
              </div>
            );
          }
          if (row.status === "empty") {
            return (
              <div
                key={`${row.ch}-${i}-empty`}
                className="jp-text flex min-h-[6rem] min-w-[120px] flex-1 max-w-[200px] flex-col items-center justify-center rounded-lg border border-ink/10 bg-paper/60 text-lg font-bold text-muted/80"
              >
                {row.ch}
              </div>
            );
          }
          const path = row.dto.strokeSvgPath?.trim();
          if (!path) {
            return (
              <div
                key={`${row.ch}-${i}-nosvg`}
                className="jp-text flex min-h-[6rem] min-w-[120px] flex-1 max-w-[200px] flex-col items-center justify-center rounded-lg border border-ink/10 bg-paper/60 text-lg font-bold text-muted/70"
              >
                {row.ch}
              </div>
            );
          }
          return (
            <div
              key={row.dto.id}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center justify-start",
                "max-w-[min(240px,100%)] basis-[140px] sm:basis-[180px]"
              )}
            >
              <span className="jp-text mb-1 text-[11px] font-semibold text-muted">{row.ch}</span>
              <KanjiStrokeAnimation
                chainSlot={chainSlot}
                compactChrome
                kanjiId={row.dto.id}
                labels={labels}
                onChainAdvance={handleAdvance}
                orchestratorReplay={orchestratorReplay}
                strokeSvgHash={row.dto.strokeSvgHash}
                strokeSvgPath={row.dto.strokeSvgPath}
                strokeSvgSource={row.dto.strokeSvgSource}
                visualSize="lexemeTile"
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

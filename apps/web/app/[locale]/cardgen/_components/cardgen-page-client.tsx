"use client";

import {
  Button,
  Card,
  CardContent,
  ErrorState,
  PageHeader
} from "@nihongo-bjt/ui";
import Link from "next/link";
import { useCallback, useState } from "react";

import { learnerApiFetch } from "../../../../lib/learner-api";

/* ── Types ─────────────────────────────────────────────────────────────── */

interface GenerateResult {
  job: { id: string; status: string; cardsGenerated: number };
  deck: { id: string };
  cardsGenerated: number;
}

interface PreviewResult {
  estimatedCards: number;
  sampleCards: Array<{
    frontText: string;
    backText: string;
    reading?: string;
    sourceType: string;
  }>;
}

export interface CardgenLabels {
  title: string;
  subtitle: string;
  generate: string;
  preview: string;
  mode: string;
  modes: Record<string, string>;
  sourceType: string;
  sources: Record<string, string>;
  direction: string;
  directions: Record<string, string>;
  count: string;
  generating: string;
  success: string;
  viewDeck: string;
  previewResult: string;
  jobs: string;
  error: string;
}

const MODES = ["by_level", "by_topic", "by_weak_area", "daily_auto"] as const;
const SOURCES = ["lexeme", "grammar", "kanji"] as const;
const DIRECTIONS = ["jp_to_vn", "vn_to_jp", "both"] as const;
const LEVELS = ["N5", "N4", "N3", "N2", "N1"] as const;

/* ── Component ─────────────────────────────────────────────────────────── */

export function CardgenPageClient({
  labels,
  locale
}: {
  labels: CardgenLabels;
  locale: string;
}) {
  const [mode, setMode] = useState<string>("by_level");
  const [sourceType, setSourceType] = useState<string>("lexeme");
  const [direction, setDirection] = useState<string>("both");
  const [level, setLevel] = useState<string>("N5");
  const [count, setCount] = useState<number>(20);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [previewData, setPreviewData] = useState<PreviewResult | null>(null);

  /* ── Generate ────────────────────────────────────────────────────────── */

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setPreviewData(null);
    try {
      const res = await learnerApiFetch("/api/cardgen/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, sourceType, level, direction, count })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message ?? "Generation failed");
      }
      setResult(await res.json());
    } catch {
      setError(labels.error);
    } finally {
      setLoading(false);
    }
  }, [mode, sourceType, level, direction, count, labels.error]);

  /* ── Preview ─────────────────────────────────────────────────────────── */

  const handlePreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPreviewData(null);
    try {
      const res = await learnerApiFetch("/api/cardgen/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, sourceType, level, direction, count })
      });
      if (!res.ok) throw new Error("Preview failed");
      setPreviewData(await res.json());
    } catch {
      setError(labels.error);
    } finally {
      setLoading(false);
    }
  }, [mode, sourceType, level, direction, count, labels.error]);

  /* ── Render ──────────────────────────────────────────────────────────── */

  return (
    <div className="mx-auto w-full max-w-3xl px-3 py-6 sm:px-5">
      <PageHeader eyebrow={labels.title} title={labels.subtitle} />

      {error && (
        <div className="my-4">
          <ErrorState title={error} />
        </div>
      )}

      {/* ── Success result ───────────────────────────────────────────── */}
      {result && (
        <Card className="my-6 border-2 border-green-300 bg-green-50">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-lg font-bold text-green-800">
                {labels.success.replace("{count}", String(result.cardsGenerated))}
              </p>
            </div>
            <Link
              href={`/${locale}/flashcards?deckId=${result.deck.id}`}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              {labels.viewDeck}
            </Link>
          </CardContent>
        </Card>
      )}

      {/* ── Config form ──────────────────────────────────────────────── */}
      <Card className="mt-6">
        <CardContent className="space-y-6 p-6">
          {/* Mode */}
          <div>
            <label className="mb-2 block text-sm font-medium text-ink/70">
              {labels.mode}
            </label>
            <div className="flex flex-wrap gap-2">
              {MODES.map((m) => (
                <button
                  key={m}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    mode === m
                      ? "bg-accent text-white"
                      : "bg-surface text-ink/70 hover:bg-surface-hover"
                  }`}
                  onClick={() => setMode(m)}
                >
                  {labels.modes[m] ?? m}
                </button>
              ))}
            </div>
          </div>

          {/* Source type */}
          {mode !== "by_weak_area" && (
            <div>
              <label className="mb-2 block text-sm font-medium text-ink/70">
                {labels.sourceType}
              </label>
              <div className="flex flex-wrap gap-2">
                {SOURCES.map((s) => (
                  <button
                    key={s}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      sourceType === s
                        ? "bg-accent text-white"
                        : "bg-surface text-ink/70 hover:bg-surface-hover"
                    }`}
                    onClick={() => setSourceType(s)}
                  >
                    {labels.sources[s] ?? s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Level */}
          {(mode === "by_level" || mode === "daily_auto") && (
            <div>
              <label className="mb-2 block text-sm font-medium text-ink/70">
                JLPT Level
              </label>
              <div className="flex flex-wrap gap-2">
                {LEVELS.map((l) => (
                  <button
                    key={l}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      level === l
                        ? "bg-accent text-white"
                        : "bg-surface text-ink/70 hover:bg-surface-hover"
                    }`}
                    onClick={() => setLevel(l)}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Direction */}
          <div>
            <label className="mb-2 block text-sm font-medium text-ink/70">
              {labels.direction}
            </label>
            <div className="flex flex-wrap gap-2">
              {DIRECTIONS.map((d) => (
                <button
                  key={d}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    direction === d
                      ? "bg-accent text-white"
                      : "bg-surface text-ink/70 hover:bg-surface-hover"
                  }`}
                  onClick={() => setDirection(d)}
                >
                  {labels.directions[d] ?? d}
                </button>
              ))}
            </div>
          </div>

          {/* Count slider */}
          <div>
            <label className="mb-2 block text-sm font-medium text-ink/70">
              {labels.count}: <strong>{count}</strong>
            </label>
            <input
              type="range"
              min={5}
              max={100}
              step={5}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full accent-accent"
            />
            <div className="flex justify-between text-xs text-ink/40">
              <span>5</span>
              <span>50</span>
              <span>100</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleGenerate}
              variant="primary"
              size="lg"
              disabled={loading}
            >
              {loading ? labels.generating : labels.generate}
            </Button>
            <Button
              onClick={handlePreview}
              variant="secondary"
              size="lg"
              disabled={loading}
            >
              {labels.preview}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Preview results ──────────────────────────────────────────── */}
      {previewData && (
        <Card className="mt-6">
          <CardContent className="p-6">
            <h3 className="text-lg font-bold text-ink">
              {labels.previewResult.replace("{count}", String(previewData.estimatedCards))}
            </h3>
            {previewData.sampleCards.length > 0 && (
              <div className="mt-4 space-y-3">
                {previewData.sampleCards.map((card, i) => (
                  <div
                    key={i}
                    className="flex gap-4 rounded-lg bg-surface p-3"
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium text-ink">
                        {card.frontText}
                      </div>
                      {card.reading && (
                        <div className="text-xs text-ink/50">{card.reading}</div>
                      )}
                    </div>
                    <div className="flex-1 text-right text-sm text-ink/70">
                      {card.backText}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

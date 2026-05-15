"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@nihongo-bjt/ui";

import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";
import { learnerApiFetch } from "../../../../lib/learner-api";

const LEVELS = ["J5", "J4", "J3", "J2", "J1", "J1+"] as const;
const SOURCE_TYPES = ["lexeme", "kanji", "grammar"] as const;
const DIRECTIONS = ["jp_to_vn", "vn_to_jp", "both"] as const;

export interface CardgenLabels {
  title: string;
  subtitle: string;
  generate: string;
  preview: string;
  mode: string;
  modes: { by_level: string; by_topic: string; by_weak_area: string; daily_auto: string };
  sourceType: string;
  sources: { lexeme: string; grammar: string; kanji: string };
  direction: string;
  directions: { jp_to_vn: string; vn_to_jp: string; both: string };
  count: string;
  generating: string;
  success: string;
  viewDeck: string;
  previewResult: string;
  jobs: string;
  error: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  locale: string;
  labels: CardgenLabels;
}

export function AutoGenDialog({ open, onClose, locale, labels }: Props) {
  const { userId } = useKeycloakAuth();
  const router = useRouter();

  const [level, setLevel] = useState<string>("J5");
  const [sourceTypes, setSourceTypes] = useState<Set<string>>(new Set(["lexeme"]));
  const [direction, setDirection] = useState<string>("jp_to_vn");
  const [cardCount, setCardCount] = useState(20);
  const [adaptive, setAdaptive] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [result, setResult] = useState<{ id: string; titleVi: string; cardCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleSource = (s: string) => {
    setSourceTypes((prev) => {
      const next = new Set(prev);
      if (next.has(s)) {
        if (next.size > 1) next.delete(s);
      } else {
        next.add(s);
      }
      return next;
    });
  };

  const fetchPreview = useCallback(async () => {
    if (!userId) return;
    setPreviewLoading(true);
    try {
      const res = await learnerApiFetch("/api/flashcards/decks/generate/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level,
          sourceTypes: [...sourceTypes],
          userId
        })
      });
      if (res.ok) {
        const data = (await res.json()) as { total: number };
        setPreview(data.total);
      }
    } catch {
      /* silent */
    } finally {
      setPreviewLoading(false);
    }
  }, [level, sourceTypes, userId]);

  useEffect(() => {
    if (open) {
      setResult(null);
      setError(null);
      void fetchPreview();
    }
  }, [open, fetchPreview]);

  const handleGenerate = async () => {
    if (!userId || generating) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await learnerApiFetch("/api/flashcards/decks/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level,
          sourceTypes: [...sourceTypes],
          direction,
          cardCount,
          adaptive,
          userId
        })
      });
      if (!res.ok) {
        const data = (await res.json()) as { code?: string; message?: string };
        setError(data.message ?? labels.error);
        return;
      }
      const data = (await res.json()) as { id: string; titleVi: string; cardCount: number };
      setResult(data);
    } catch {
      setError(labels.error);
    } finally {
      setGenerating(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl border border-ink/10 bg-surface p-6 shadow-2xl">
        <h2 className="text-lg font-black text-ink">{labels.title}</h2>
        <p className="mt-1 text-sm text-muted">{labels.subtitle}</p>

        {result ? (
          <div className="mt-6 space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <span className="text-3xl" aria-hidden>✨</span>
            </div>
            <p className="text-sm font-bold text-ink">
              {labels.success.replace("{count}", String(result.cardCount))}
            </p>
            <div className="flex justify-center gap-2">
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  router.push(`/${locale}/flashcards/decks/${result.id}`);
                  onClose();
                }}
              >
                {labels.viewDeck}
              </Button>
              <Button size="sm" variant="secondary" onClick={onClose}>
                ✕
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {/* Level */}
            <fieldset>
              <legend className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted">
                Level
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {LEVELS.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLevel(l)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                      level === l
                        ? "bg-accent text-white shadow-sm"
                        : "bg-paper text-muted hover:bg-ink/5"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Source types */}
            <fieldset>
              <legend className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted">
                {labels.sourceType}
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {SOURCE_TYPES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSource(s)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                      sourceTypes.has(s)
                        ? "bg-accent text-white shadow-sm"
                        : "bg-paper text-muted hover:bg-ink/5"
                    }`}
                  >
                    {labels.sources[s as keyof typeof labels.sources]}
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Direction */}
            <fieldset>
              <legend className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted">
                {labels.direction}
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {DIRECTIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDirection(d)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                      direction === d
                        ? "bg-accent text-white shadow-sm"
                        : "bg-paper text-muted hover:bg-ink/5"
                    }`}
                  >
                    {labels.directions[d as keyof typeof labels.directions]}
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Card count slider */}
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">
                {labels.count}: <span className="font-black text-ink">{cardCount}</span>
              </label>
              <input
                type="range"
                min={5}
                max={50}
                step={5}
                value={cardCount}
                onChange={(e) => setCardCount(Number(e.target.value))}
                className="w-full accent-accent"
              />
            </div>

            {/* Adaptive toggle */}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={adaptive}
                onChange={(e) => setAdaptive(e.target.checked)}
                className="h-4 w-4 rounded accent-accent"
              />
              <span className="font-semibold text-ink">{labels.modes.by_weak_area}</span>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                Premium
              </span>
            </label>

            {/* Preview */}
            {preview !== null && (
              <p className="text-xs font-semibold text-muted">
                {previewLoading ? "..." : labels.previewResult.replace("{count}", String(preview))}
              </p>
            )}

            {/* Error */}
            {error && (
              <p className="text-sm font-semibold text-red-600">{error}</p>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                variant="primary"
                disabled={generating}
                onClick={handleGenerate}
                className="flex-1"
              >
                {generating ? labels.generating : labels.generate}
              </Button>
              <Button size="sm" variant="secondary" onClick={onClose}>
                ✕
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

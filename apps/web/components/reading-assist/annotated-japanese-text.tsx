"use client";

import { ReadingAssistPopoverPanel } from "@nihongo-bjt/ui";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import type { ReadingAssistDisplayMode } from "@nihongo-bjt/shared";
import { learnerApiFetch } from "../../lib/learner-api";

export type { ReadingAssistDisplayMode } from "@nihongo-bjt/shared";

export type AnalyzedReadingToken = {
  basicForm: string;
  end: number;
  index: number;
  lexemeId: string | null;
  meaningHidden?: boolean;
  partOfSpeech: string;
  reading: string;
  shortMeaningVi: string | null;
  start: number;
  surface: string;
};

type Labels = {
  addCardAction: string;
  addCardError: string;
  addCardNoDeck: string;
  addCardSuccess: string;
  bottomSheetClose: string;
  errorHttp: string;
  errorNetwork: string;
  errorTimeout: string;
  furiganaLabel: string;
  lexemeLine: string;
  loadingText: string;
  meaningLabel: string;
  posLabel: string;
  retryAction: string;
  serviceUnavailable: string;
};

type Props = {
  /** API path only, e.g. `/api/reading-assist/analyze` (Bearer added when Keycloak is enabled). */
  analyzePath: string;
  analyticsPath: string;
  anonymousId?: string;
  displayMode: ReadingAssistDisplayMode;
  /** When set, meanings are hidden server-side (timed BJT). */
  examTimed?: boolean;
  /** Authoritative backend session binding for quiz-timed meaning visibility. */
  quizSessionId?: string;
  labels: Labels;
  onAnalyzed?: (payload: { textHash: string; tokens: AnalyzedReadingToken[] }) => void;
  sessionId?: string;
  text: string;
  userId: string;
};

type AnalyzePayload = {
  normalized: string;
  textHash: string;
  tokens: AnalyzedReadingToken[];
};

const ANALYZE_TIMEOUT_MS = 5000;
const inFlightAnalyzeRequests = new Map<string, Promise<AnalyzePayload>>();

function showFuriganaInPlace(mode: ReadingAssistDisplayMode) {
  return mode === "beginner" || mode === "full_furigana";
}

export function AnnotatedJapaneseText({
  analyzePath,
  analyticsPath,
  anonymousId,
  displayMode,
  examTimed = false,
  quizSessionId,
  labels,
  onAnalyzed,
  sessionId,
  text,
  userId
}: Props) {
  const [tokens, setTokens] = useState<AnalyzedReadingToken[]>([]);
  const [normalized, setNormalized] = useState<string>("");
  const [textHash, setTextHash] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState<AnalyzedReadingToken | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deckId, setDeckId] = useState<string | null>(null);
  const [deckLoadFailed, setDeckLoadFailed] = useState(false);
  const [flashcardMessage, setFlashcardMessage] = useState<string | null>(null);
  const sheetId = useId();
  const sheetPanelRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  const ruby = showFuriganaInPlace(displayMode);
  const interactive = displayMode !== "off";

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }
    const mq = window.matchMedia("(pointer: coarse)");
    const apply = () => setIsCoarsePointer(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const loadDeck = useCallback(async () => {
    if (!interactive) {
      return;
    }
    try {
      const response = await learnerApiFetch(
        `/api/decks?userId=${encodeURIComponent(userId)}&limit=1`,
        {
          method: "GET"
        }
      );
      if (!response.ok) {
        setDeckId(null);
        setDeckLoadFailed(true);
        return;
      }
      const decks = (await response.json()) as Array<{ id: string }>;
      setDeckId(decks[0]?.id ?? null);
      setDeckLoadFailed(false);
    } catch {
      setDeckId(null);
      setDeckLoadFailed(true);
    }
  }, [interactive, userId]);

  useEffect(() => {
    if (!interactive) {
      return;
    }
    void loadDeck();
  }, [interactive, loadDeck]);

  const runAnalyze = useCallback(async () => {
    if (!interactive) {
      setTokens([]);
      setNormalized(text);
      setTextHash("");
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { text, userId };
      if (quizSessionId) {
        body.quizSessionId = quizSessionId;
      }
      if (examTimed) {
        body.examContext = { answerSubmitted: false, kind: "bjt_quiz", mode: "timed" };
      }

      const requestKey = JSON.stringify({ examTimed, quizSessionId: quizSessionId ?? "", text, userId });
      let request = inFlightAnalyzeRequests.get(requestKey);
      if (!request) {
        request = (async () => {
          const controller = new AbortController();
          const timeoutId = window.setTimeout(() => controller.abort(), ANALYZE_TIMEOUT_MS);
          try {
            const r = await learnerApiFetch(analyzePath, {
              body: JSON.stringify(body),
              headers: { "content-type": "application/json" },
              method: "POST",
              signal: controller.signal
            });
            if (!r.ok) {
              throw new Error("analyze_http_error");
            }
            return (await r.json()) as AnalyzePayload;
          } finally {
            window.clearTimeout(timeoutId);
          }
        })();
        inFlightAnalyzeRequests.set(requestKey, request);
      }
      const j = await request.finally(() => {
        inFlightAnalyzeRequests.delete(requestKey);
      });

      setTokens(j.tokens);
      setTextHash(j.textHash);
      setNormalized(j.normalized);
      onAnalyzed?.({ textHash: j.textHash, tokens: j.tokens });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === "analyze_http_error") {
        setError(labels.errorHttp);
      } else if (err instanceof DOMException && err.name === "AbortError") {
        setError(labels.errorTimeout);
      } else {
        setError(labels.errorNetwork);
      }
    } finally {
      setLoading(false);
    }
  }, [analyzePath, examTimed, interactive, labels.errorHttp, labels.errorNetwork, labels.errorTimeout, onAnalyzed, quizSessionId, text, userId]);

  useEffect(() => {
    if (!interactive) {
      setTokens([]);
      setNormalized(text);
      setTextHash("");
      setError(null);
      setLoading(false);
      return;
    }
    void runAnalyze();
  }, [interactive, runAnalyze, text]);

  const openDetails = (t: AnalyzedReadingToken) => {
    if (!interactive) {
      return;
    }
    setActive(t);
    setFlashcardMessage(null);
    if (isCoarsePointer) {
      restoreFocusRef.current = document.activeElement as HTMLElement | null;
      setSheetOpen(true);
    }
  };

  const addTokenToFlashcard = useCallback(async (token: AnalyzedReadingToken) => {
    if (!deckId) {
      setFlashcardMessage(deckLoadFailed ? labels.serviceUnavailable : labels.addCardNoDeck);
      return;
    }

    try {
      const response = await learnerApiFetch("/api/reading-assist/flashcard", {
        body: JSON.stringify({
          backText: token.shortMeaningVi ?? token.basicForm,
          deckId,
          frontText: token.surface,
          reading: token.reading,
          userId
        }),
        headers: { "content-type": "application/json" },
        method: "POST"
      });

      if (!response.ok) {
        setFlashcardMessage(labels.addCardError);
        return;
      }

      setFlashcardMessage(labels.addCardSuccess);
      if (textHash) {
        void learnerApiFetch(analyticsPath, {
          body: JSON.stringify({
            eventName: "reading_assist_add_card",
            sessionId,
            textHash,
            tokenIndex: token.index,
            userId
          }),
          headers: { "content-type": "application/json" },
          method: "POST"
        });
      }
    } catch {
      setFlashcardMessage(labels.addCardError);
    }
  }, [analyticsPath, deckId, deckLoadFailed, labels.addCardError, labels.addCardNoDeck, labels.addCardSuccess, labels.serviceUnavailable, sessionId, textHash, userId]);

  useEffect(() => {
    if (!sheetOpen || !sheetPanelRef.current) {
      if (!sheetOpen) {
        restoreFocusRef.current?.focus();
      }
      return;
    }

    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (!sheetPanelRef.current) {
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setSheetOpen(false);
        return;
      }
      if (event.key !== "Tab") {
        return;
      }
      const focusable = sheetPanelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) {
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [sheetOpen]);

  const trackOpen = (t: AnalyzedReadingToken) => {
    if (!textHash || !interactive) {
      return;
    }
    void learnerApiFetch(analyticsPath, {
      body: JSON.stringify({
        anonymousId,
        eventName: "reading_assist_token_open",
        sessionId,
        textHash,
        tokenIndex: t.index,
        userId
      }),
      headers: { "content-type": "application/json" },
      method: "POST"
    });
  };

  if (error) {
    return (
      <div className="annotated-ja--error" role="status" aria-live="polite">
        <div className="jp-text mb-3 text-sm leading-relaxed whitespace-pre-wrap" lang="ja">{text}</div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <span>{error}</span>
          <button
            className="rounded-lg border border-ink/15 bg-surface px-2 py-1 text-xs font-medium text-ink"
            onClick={() => void runAnalyze()}
            type="button"
          >
            {labels.retryAction}
          </button>
        </div>
      </div>
    );
  }

  if (loading && tokens.length === 0) {
    return (
      <div className="annotated-ja--loading" role="status" aria-live="polite" aria-busy="true">
        <p className="text-sm text-muted">{labels.loadingText}</p>
      </div>
    );
  }

  if (displayMode === "off") {
    if (loading) {
      return (
        <div className="annotated-ja--loading" role="status" aria-live="polite" aria-busy="true">
          <p className="text-sm text-muted" lang="ja">
            {labels.loadingText}
          </p>
        </div>
      );
    }
    return (
      <p className="jp-text" lang="ja">
        {normalized || text}
      </p>
    );
  }

  if (tokens.length === 0) {
    return (
      <p className="jp-text" lang="ja">
        {text}
      </p>
    );
  }

  return (
    <div className="annotated-ja" lang="ja">
      {deckLoadFailed ? (
        <div className="mb-2 rounded-lg border border-sakura/30 bg-sakura/10 px-3 py-2 text-xs text-sakura" role="status">
          <p>{labels.serviceUnavailable}</p>
          <button
            className="mt-2 rounded-lg border border-sakura/40 bg-surface px-2 py-1 text-xs font-medium text-sakura"
            onClick={() => void loadDeck()}
            type="button"
          >
            {labels.retryAction}
          </button>
        </div>
      ) : null}
      <div className="jp-text" style={loading ? { opacity: 0.6 } : undefined}>
        {tokens.map((t) => {
          const key = `t-${t.start}-${t.end}`;
          const useRuby = ruby && t.reading.length > 0;
          const el = useRuby ? (
            <ruby key={key}>
              {interactive ? (
                <button
                  className="annotated-ja__token"
                  onClick={() => {
                    openDetails(t);
                    trackOpen(t);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openDetails(t);
                      trackOpen(t);
                    }
                  }}
                  onMouseEnter={() => {
                    if (interactive && !isCoarsePointer) {
                      setActive(t);
                      setSheetOpen(false);
                    }
                  }}
                  type="button"
                >
                  {t.surface}
                </button>
              ) : (
                t.surface
              )}
              <rt>{t.reading}</rt>
            </ruby>
          ) : (
            <span key={key} className="annotated-ja__token-wrap">
              {interactive ? (
                <button
                  className="annotated-ja__token"
                  onClick={() => {
                    openDetails(t);
                    trackOpen(t);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openDetails(t);
                      trackOpen(t);
                    }
                  }}
                  onMouseEnter={() => {
                    if (!isCoarsePointer) {
                      setActive(t);
                      setSheetOpen(false);
                    }
                  }}
                  type="button"
                >
                  {t.surface}
                </button>
              ) : (
                t.surface
              )}
              {!isCoarsePointer && interactive && active?.index === t.index ? (
                <ReadingAssistPopoverPanel
                  aria-live="polite"
                  className="absolute left-0 top-full z-20 mt-1 min-w-[12rem] max-w-[280px]"
                  role="tooltip"
                >
                  {t.reading ? (
                    <span className="annotated-ja__tip-line block">
                      <strong>{labels.furiganaLabel}</strong> {t.reading}
                    </span>
                  ) : null}
                  {t.meaningHidden ? null : t.shortMeaningVi ? (
                    <span className="annotated-ja__tip-line block">
                      <strong>{labels.meaningLabel}</strong> {t.shortMeaningVi}
                    </span>
                  ) : null}
                  {t.lexemeId ? (
                    <span className="annotated-ja__tip-line muted block">{labels.lexemeLine}</span>
                  ) : null}
                  <span className="annotated-ja__tip-line muted block">
                    {labels.posLabel} {t.partOfSpeech}
                  </span>
                  <button
                    className="mt-2 rounded-lg border border-ink/15 bg-surface px-2 py-1 text-xs font-medium text-ink"
                    onClick={() => void addTokenToFlashcard(t)}
                    type="button"
                  >
                    {labels.addCardAction}
                  </button>
                  {flashcardMessage ? (
                    <span className="annotated-ja__tip-line block text-xs text-muted" role="status">
                      {flashcardMessage}
                    </span>
                  ) : null}
                </ReadingAssistPopoverPanel>
              ) : null}
            </span>
          );
          return el;
        })}
      </div>

      {isCoarsePointer && sheetOpen && active && interactive ? (
        <div
          aria-modal="true"
          className="annotated-ja__sheet"
          id={sheetId}
          onClick={() => setSheetOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setSheetOpen(false);
            }
          }}
          role="dialog"
        >
          <div
            className="annotated-ja__sheet-panel"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            ref={sheetPanelRef}
          >
            <div className="annotated-ja__sheet-header">
              <span className="jp-text-lg">{active.surface}</span>
              <button
                className="secondary-button"
                onClick={() => setSheetOpen(false)}
                ref={closeButtonRef}
                type="button"
              >
                {labels.bottomSheetClose}
              </button>
            </div>
            {active.reading ? (
              <p>
                <strong>{labels.furiganaLabel}</strong> {active.reading}
              </p>
            ) : null}
            {active.meaningHidden ? null : active.shortMeaningVi ? (
              <p>
                <strong>{labels.meaningLabel}</strong> {active.shortMeaningVi}
              </p>
            ) : null}
            <p className="muted">
              {labels.posLabel} {active.partOfSpeech}
            </p>
            <button
              className="mt-3 rounded-lg border border-ink/15 bg-surface px-3 py-2 text-sm font-medium text-ink"
              onClick={() => void addTokenToFlashcard(active)}
              type="button"
            >
              {labels.addCardAction}
            </button>
            {flashcardMessage ? (
              <p className="mt-2 text-sm text-muted" role="status">
                {flashcardMessage}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

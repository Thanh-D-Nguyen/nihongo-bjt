"use client";

import type { BookmarkTargetType } from "@nihongo-bjt/shared";
import { useCallback, useEffect, useState } from "react";

import { cancelJapaneseSpeechSynthesis, speakJapaneseWithBrowserTts } from "../../quiz/_components/bjt-audio-player";
import { learnerApiFetch } from "../../../../lib/learner-api";
import { cn } from "@nihongo-bjt/ui";

function IconSpinner({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={cn("h-4 w-4 animate-spin text-muted motion-reduce:animate-none", className)}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path
        className="opacity-90"
        d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconBookmarkOutline({ className }: { className?: string }) {
  return (
    <svg aria-hidden className={className} fill="none" height="20" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24" width="20">
      <path d="M6 4h12a2 2 0 0 1 2 2v16l-7-3.5L6 22V6a2 2 0 0 1 2-2z" strokeLinejoin="round" />
    </svg>
  );
}

function IconBookmarkFilled({ className }: { className?: string }) {
  return (
    <svg aria-hidden className={className} fill="currentColor" height="20" viewBox="0 0 24 24" width="20">
      <path d="M6 2h12a2 2 0 0 1 2 2v18l-8-4-8 4V4a2 2 0 0 1 2-2z" />
    </svg>
  );
}

function IconVolume({ className }: { className?: string }) {
  return (
    <svg aria-hidden className={className} fill="none" height="20" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24" width="20">
      <path d="M11 5L6 9H3v6h3l5 4V5z" strokeLinejoin="round" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" strokeLinecap="round" />
      <path d="M18.07 5.93a9 9 0 0 1 0 12.14" strokeLinecap="round" />
    </svg>
  );
}

function IconStop({ className }: { className?: string }) {
  return (
    <svg aria-hidden className={className} fill="currentColor" height="18" viewBox="0 0 24 24" width="18">
      <rect height="14" rx="1" width="14" x="5" y="5" />
    </svg>
  );
}

function IconRefresh({ className }: { className?: string }) {
  return (
    <svg aria-hidden className={className} fill="none" height="18" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24" width="18">
      <path d="M21 12a9 9 0 1 1-2.64-6.36" strokeLinecap="round" />
      <path d="M21 3v6h-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export type SearchBookmarkLabels = {
  add: string;
  busy: string;
  error: string;
  remove: string;
  retry: string;
  signIn: string;
};

export type SearchReadAloudLabels = {
  read: string;
  readSentence: string;
  stop: string;
  /** Optional; only shown when `showTtsNotice` is true */
  ttsNotice?: string;
};

export function SearchBookmarkToggle({
  labels,
  targetId,
  targetType,
  userId
}: {
  labels: SearchBookmarkLabels;
  targetId: string;
  targetType: BookmarkTargetType;
  userId: string | null;
}) {
  const [bookmarked, setBookmarked] = useState(false);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [busy, setBusy] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (!userId || !targetId) {
      setLoadState("idle");
      return;
    }
    let cancelled = false;
    setLoadState("loading");
    void learnerApiFetch(`/api/bookmarks/check/${targetType}/${encodeURIComponent(targetId)}`)
      .then(async (r: Response) => {
        if (!r.ok) {
          if (!cancelled) setLoadState("error");
          return;
        }
        const d = (await r.json()) as { bookmarked?: boolean };
        if (!cancelled) {
          setBookmarked(Boolean(d.bookmarked));
          setLoadState("ready");
        }
      })
      .catch(() => {
        if (!cancelled) setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [targetId, targetType, userId, retryToken]);

  const toggle = useCallback(async () => {
    if (!userId || busy || !targetId || loadState !== "ready") return;
    setBusy(true);
    try {
      const r = await learnerApiFetch(`/api/bookmarks/${targetType}/${encodeURIComponent(targetId)}`, {
        method: "POST"
      });
      if (!r.ok) return;
      const d = (await r.json()) as { bookmarked?: boolean };
      setBookmarked(Boolean(d.bookmarked));
    } catch {
      /* keep prior state */
    } finally {
      setBusy(false);
    }
  }, [busy, loadState, targetId, targetType, userId]);

  if (!userId) {
    return <p className="text-[11px] leading-relaxed text-muted">{labels.signIn}</p>;
  }
  if (loadState === "loading") {
    return (
      <span
        aria-busy="true"
        aria-label={labels.busy}
        className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-ink/10 bg-paper/60"
        role="status"
        title={labels.busy}
      >
        <IconSpinner />
      </span>
    );
  }
  if (loadState === "error") {
    return (
      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] text-sakura">{labels.error}</p>
        <button
          aria-label={labels.retry}
          className="inline-flex min-h-10 min-w-10 items-center justify-center self-start rounded-lg border border-ink/12 bg-paper text-ink/85 hover:bg-ink/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
          onClick={() => setRetryToken((n) => n + 1)}
          title={labels.retry}
          type="button"
        >
          <IconRefresh />
        </button>
      </div>
    );
  }
  if (loadState !== "ready") {
    return null;
  }

  const bookmarkLabel = busy ? labels.busy : bookmarked ? labels.remove : labels.add;

  return (
    <button
      aria-busy={busy}
      aria-label={bookmarkLabel}
      aria-pressed={bookmarked}
      className={cn(
        "inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border p-0 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30",
        bookmarked
          ? "border-sakura/30 bg-sakura-soft/40 text-sakura hover:bg-sakura-soft/60"
          : "border-ink/12 bg-paper text-ink/85 hover:bg-ink/5",
        busy && "opacity-70"
      )}
      disabled={busy}
      onClick={() => void toggle()}
      title={bookmarkLabel}
      type="button"
    >
      {busy ? <IconSpinner /> : bookmarked ? <IconBookmarkFilled /> : <IconBookmarkOutline />}
    </button>
  );
}

export function SearchReadAloudButton({
  className,
  compact,
  labels,
  showTtsNotice = true,
  text
}: {
  className?: string;
  compact?: boolean;
  labels: SearchReadAloudLabels;
  showTtsNotice?: boolean;
  text: string;
}) {
  const [speaking, setSpeaking] = useState(false);
  const trimmed = text.trim();

  useEffect(() => {
    return () => {
      cancelJapaneseSpeechSynthesis();
    };
  }, []);

  if (!trimmed) return null;

  const start = () => {
    cancelJapaneseSpeechSynthesis();
    speakJapaneseWithBrowserTts(trimmed, {
      onEnd: () => setSpeaking(false),
      onError: () => setSpeaking(false),
      onStart: () => setSpeaking(true)
    });
  };

  const stop = () => {
    cancelJapaneseSpeechSynthesis();
    setSpeaking(false);
  };

  const readLabel = compact ? labels.readSentence : labels.read;

  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {speaking ? (
          <button
            aria-label={labels.stop}
            className={cn(
              "inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-sakura/25 bg-sakura-soft/30 text-sakura hover:bg-sakura-soft/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30",
              compact && "min-h-9 min-w-9"
            )}
            onClick={stop}
            title={labels.stop}
            type="button"
          >
            <IconStop />
          </button>
        ) : (
          <button
            aria-label={readLabel}
            className={cn(
              "inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-ink/12 bg-paper text-ink/85 hover:bg-ink/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30",
              compact && "min-h-9 min-w-9"
            )}
            onClick={start}
            title={readLabel}
            type="button"
          >
            <IconVolume />
          </button>
        )}
      </div>
      {showTtsNotice && labels.ttsNotice ? (
        <p className="text-[9px] leading-snug text-muted/80">{labels.ttsNotice}</p>
      ) : null}
    </div>
  );
}

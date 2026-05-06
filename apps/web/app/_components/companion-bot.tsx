"use client";

import type { BattleBotAnimationState, CompanionActionKind, CompanionHintResponse, CompanionReasonCode } from "@nihongo-bjt/shared";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useKeycloakAuth } from "../../components/auth/keycloak-auth-provider";
import { learnerApiFetch } from "../../lib/learner-api";
import { BattleBotAvatar } from "./battle-bot-avatar";

export type CompanionBotReasonLabels = Record<CompanionReasonCode, string>;

export type CompanionBotLabels = {
  actionAnalytics: string;
  actionBattle: string;
  actionDaily: string;
  actionQuiz: string;
  actionReview: string;
  ariaLabel: string;
  close: string;
  collapsedLabel: string;
  hintError: string;
  hintLoading: string;
  moodIdle: string;
  moodThinking: string;
  primaryCtaAria: string;
  reasons: CompanionBotReasonLabels;
  secondaryLabel: string;
  subtitle: string;
  title: string;
};

const companionRive = {
  artboard: null,
  src: "/assets/battle/bots/24876-46460-interactive-bunny-character.riv",
  stateMachine: null
};

function applyReasonTemplate(
  template: string,
  params: Record<string, string | number | boolean>
): string {
  let out = template;
  for (const [k, v] of Object.entries(params)) {
    out = out.replaceAll(`{${k}}`, String(v));
  }
  return out;
}

function actionLabel(kind: CompanionActionKind, labels: CompanionBotLabels): string {
  switch (kind) {
    case "analytics_reflect":
      return labels.actionAnalytics;
    case "battle_bot":
      return labels.actionBattle;
    case "bjt_quiz":
      return labels.actionQuiz;
    case "daily_hub":
      return labels.actionDaily;
    case "srs_review":
      return labels.actionReview;
    default:
      return labels.title;
  }
}

function formatReason(labels: CompanionBotLabels, code: CompanionReasonCode, params: Record<string, string | number | boolean>) {
  const template = labels.reasons[code] ?? code;
  return applyReasonTemplate(template, params);
}

export function CompanionBot({ base, labels }: { base: string; labels: CompanionBotLabels }) {
  const { accessToken } = useKeycloakAuth();
  const [open, setOpen] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [hint, setHint] = useState<CompanionHintResponse | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [hintError, setHintError] = useState(false);

  const loadHint = useCallback(async () => {
    setHintLoading(true);
    setHintError(false);
    try {
      const res = await learnerApiFetch("/api/companion/hint?days=7");
      if (!res.ok) {
        setHintError(true);
        setHint(null);
        return;
      }
      const json = (await res.json()) as CompanionHintResponse;
      setHint(json);
    } catch {
      setHintError(true);
      setHint(null);
    } finally {
      setHintLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open || !accessToken) {
      return;
    }
    void loadHint();
  }, [accessToken, loadHint, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const interval = window.setInterval(() => {
      setThinking((current) => !current);
    }, 4200);
    return () => window.clearInterval(interval);
  }, [open]);

  const state = useMemo<BattleBotAnimationState>(
    () => (thinking ? "thinking" : "idle"),
    [thinking]
  );

  const primaryLine = useMemo(() => {
    if (hintLoading) {
      return labels.hintLoading;
    }
    if (hintError || !hint) {
      return labels.subtitle;
    }
    const r = hint.primary.reasons[0];
    if (!r) {
      return labels.subtitle;
    }
    return formatReason(labels, r.code, r.params);
  }, [hint, hintError, hintLoading, labels]);

  const primaryHref = hint ? `${base}${hint.primary.hrefSuffix}` : null;
  const primaryText = hint ? actionLabel(hint.primary.action, labels) : null;

  if (!accessToken) {
    return null;
  }

  return (
    <aside
      aria-label={labels.ariaLabel}
      className="fixed bottom-20 right-4 z-30 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2 sm:bottom-5 sm:right-5"
    >
      {open ? (
        <div className="w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-ink/10 bg-surface p-3 shadow-xl">
          <div className="grid grid-cols-[72px_1fr_auto] items-start gap-3">
            <BattleBotAvatar
              className="h-full w-full rounded-2xl"
              fallback="J3"
              label={labels.title}
              rive={companionRive}
              state={state}
              variant="companion"
            />
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-ink">{labels.title}</h2>
              <p className="mt-1 text-xs leading-5 text-muted">{primaryLine}</p>
              <p className="mt-2 text-[11px] font-semibold text-accent">
                {thinking ? labels.moodThinking : labels.moodIdle}
              </p>
            </div>
            <button
              aria-label={labels.close}
              className="grid h-8 w-8 place-items-center rounded-full border border-ink/10 text-sm font-bold text-muted hover:bg-ink/5 hover:text-ink"
              onClick={() => setOpen(false)}
              type="button"
            >
              ×
            </button>
          </div>
          {primaryHref && primaryText ? (
            <div className="mt-3">
              <a
                aria-label={labels.primaryCtaAria}
                className="inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-ink px-3 text-xs font-bold text-surface hover:bg-ink/90"
                href={primaryHref}
              >
                {primaryText}
              </a>
            </div>
          ) : null}
          <div className="mt-3 grid grid-cols-2 gap-2">
            {hint && hint.alternatives.length > 0 ? (
              <>
                <p className="col-span-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
                  {labels.secondaryLabel}
                </p>
                {hint.alternatives.slice(0, 2).map((alt) => (
                  <a
                    className="inline-flex min-h-10 items-center justify-center rounded-xl border border-ink/10 bg-paper px-2 text-center text-[11px] font-bold text-ink hover:bg-ink/5"
                    href={`${base}${alt.hrefSuffix}`}
                    key={alt.action}
                  >
                    {actionLabel(alt.action, labels)}
                  </a>
                ))}
              </>
            ) : (
              <>
                <a
                  className="inline-flex min-h-10 items-center justify-center rounded-xl bg-ink px-3 text-xs font-bold text-surface hover:bg-ink/90"
                  href={`${base}/battle`}
                >
                  {labels.actionBattle}
                </a>
                <a
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border border-ink/10 bg-paper px-3 text-xs font-bold text-ink hover:bg-ink/5"
                  href={`${base}/flashcards`}
                >
                  {labels.actionReview}
                </a>
              </>
            )}
          </div>
          {hintError ? <p className="mt-2 text-[11px] text-sakura">{labels.hintError}</p> : null}
        </div>
      ) : null}
      <button
        aria-label={labels.collapsedLabel}
        className="grid h-16 w-16 place-items-center rounded-2xl border border-ink/10 bg-surface p-1.5 shadow-xl transition hover:-translate-y-0.5 hover:shadow-2xl"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <BattleBotAvatar
          className="h-full w-full"
          fallback="J3"
          rive={companionRive}
          showSignal={false}
          state={state}
          variant="companion"
        />
      </button>
    </aside>
  );
}

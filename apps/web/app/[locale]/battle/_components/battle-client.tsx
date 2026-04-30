"use client";

import { Card, CardContent, PageHeader } from "@nihongo-bjt/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";

const botKeys = ["bot_j2", "bot_j3", "bot_j4"] as const;

export type BattlePageLabels = {
  eyebrow: string;
  botsJ2: string;
  botsJ3: string;
  botsJ4: string;
  connecting: string;
  error: string;
  noQuestions: string;
  finishedDraw: string;
  finishedLose: string;
  finishedLoseCta: string;
  finishedWin: string;
  opponent: string;
  pickBot: string;
  scoreLine: string;
  start: string;
  subtitle: string;
  title: string;
  userId: string;
  userLabel: string;
  vs: string;
  shareResult?: string;
  shareResultPrivacy?: string;
};

const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
const socketUrl = apiBase;

function botName(labels: BattlePageLabels, i18nKey: string) {
  if (i18nKey === "battle.bots.j2") {
    return labels.botsJ2;
  }
  if (i18nKey === "battle.bots.j3") {
    return labels.botsJ3;
  }
  if (i18nKey === "battle.bots.j4") {
    return labels.botsJ4;
  }
  return i18nKey;
}

type QuestionEvent = {
  question: {
    options: Array<{ optionKey: string; text: string }>;
    prompt: string;
    skillTag: string;
  };
  roomCode: string;
  roundIndex: number;
  timeLimitSec: number;
  totalRounds: number;
};

type FinishedEvent = {
  outcome: "draw" | "lose" | "win";
  remediation?: { ctaPath: string; kind: string } | null;
};

export function BattleClient({ labels }: { labels: BattlePageLabels }) {
  const socketRef = useRef<Socket | null>(null);
  const { userId } = useKeycloakAuth();
  const [botKey, setBotKey] = useState<string>("bot_j3");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [opponentName, setOpponentName] = useState<string | null>(null);
  const [userScore, setUserScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [round, setQuestion] = useState<QuestionEvent | null>(null);
  const [outcome, setOutcome] = useState<"draw" | "lose" | "win" | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [remediation, setRemediation] = useState<{ ctaPath: string; kind: string } | null>(null);
  const [shareLoading, setShareLoading] = useState(false);

  const clearSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearSocket();
    };
  }, [clearSocket]);

  function connectAndStart() {
    const uid = userId;
    if (!uid) {
      return;
    }
    setError(null);
    setOutcome(null);
    setQuestion(null);
    setUserScore(0);
    setOpponentScore(0);
    setCountdown(null);
    setRemediation(null);
    setStatus(labels.connecting);
    clearSocket();
    const s = io(`${socketUrl}/battle`, {
      path: "/socket.io",
      reconnection: false,
      transports: ["websocket", "polling"]
    });
    socketRef.current = s;
    s.on("connect", () => {
      s.emit("battle:challenge_bot", { botKey, userId: uid });
    });
    s.on("battle:error", (p: { code: string } | undefined) => {
      const code = p?.code ?? "unknown";
      if (code === "no_questions") {
        setError(labels.noQuestions);
      } else {
        setError(`${labels.error} (${code})`);
      }
      setStatus(null);
    });
    s.on("battle:match_found", (p: { bot: { labelI18nKey: string } }) => {
      setOpponentName(botName(labels, p.bot.labelI18nKey));
      setStatus(null);
    });
    s.on("battle:countdown", (p: { value: number }) => {
      setCountdown(p.value);
    });
    s.on("battle:question", (p: QuestionEvent) => {
      setCountdown(null);
      setQuestion(p);
    });
    s.on("battle:score_update", (p: { opponentScore: number; userScore: number }) => {
      setUserScore(p.userScore);
      setOpponentScore(p.opponentScore);
    });
    s.on("battle:finished", (p: FinishedEvent) => {
      setQuestion(null);
      setOutcome(p.outcome);
      setRemediation(p.remediation ?? null);
      setStatus(null);
      setCountdown(null);
    });
  }

  function submitAnswer(optionKey: string) {
    const s = socketRef.current;
    const q = round;
    const uid = userId;
    if (!s || !q || !uid) {
      return;
    }
    s.emit("battle:answer", {
      idempotencyKey: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${q.roundIndex}`,
      optionKey,
      roomCode: q.roomCode,
      roundIndex: q.roundIndex,
      userId: uid
    });
  }

  async function handleShareResult() {
    const uid = userId;
    if (!uid || !outcome) {
      return;
    }
    setShareLoading(true);
    try {
      const response = await fetch(`${apiBase}/api/growth/shares/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "battle",
          payload: {
            result: outcome,
            opponentName: opponentName ?? undefined
          },
          userId: uid
        })
      });
      if (!response.ok) {
        setError("Failed to create share. Please try again.");
        return;
      }
      const data = (await response.json()) as { shareUrl: string; imagePath: string };
      // In a real app, this would open a share dialog showing the postcard and link
      // For now, we'll log it
      console.log("Share created:", data.shareUrl);
      alert(`Share created! URL: ${data.shareUrl}`);
    } catch {
      setError("Error sharing battle result. Please try again.");
    } finally {
      setShareLoading(false);
    }
  }

  return (
    <main className="w-full space-y-6 pb-12">
      <PageHeader description={labels.subtitle} eyebrow={labels.eyebrow} title={labels.title} />
      <Card className="border-ink/10 shadow-sm">
        <CardContent className="space-y-4 p-5 sm:p-6">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void connectAndStart();
            }}
          >
            <fieldset aria-label={labels.pickBot} className="space-y-2">
              <legend className="text-xs font-semibold uppercase tracking-wide text-muted">
                {labels.pickBot}
              </legend>
              {botKeys.map((k) => (
                <label
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-ink/10 bg-paper/60 px-3 py-2.5 text-sm text-ink hover:bg-paper"
                  key={k}
                >
                  <input
                    checked={botKey === k}
                    name="bot"
                    onChange={() => setBotKey(k)}
                    type="radio"
                  />
                  {k === "bot_j2" ? labels.botsJ2 : k === "bot_j3" ? labels.botsJ3 : labels.botsJ4}
                </label>
              ))}
            </fieldset>
            <button
              className="rounded-xl border border-ink/15 bg-ink px-4 py-2 text-sm font-semibold text-surface hover:bg-ink/90 disabled:opacity-50"
              disabled={!userId}
              type="submit"
            >
              {labels.start}
            </button>
          </form>
          {error ? <p role="alert">{error}</p> : null}
          {status ? <p role="status">{status}</p> : null}
          {countdown !== null ? <p className="battle-countdown">{countdown}</p> : null}
          {opponentName ? (
            <p className="battle-versus">
              {labels.userLabel} {labels.vs} {labels.opponent}: {opponentName}
            </p>
          ) : null}
          <p className="battle-scores" role="status">
            {labels.scoreLine
              .replace("{user}", String(userScore))
              .replace("{opponent}", String(opponentScore))}
          </p>
          {round ? (
            <article className="review-card battle-question" key={String(round.roundIndex)}>
              <span className="eyebrow">
              {labels.shareResult && (
                <button
                  className="inline-flex rounded-lg border border-ink/15 bg-ink px-3 py-2 text-sm font-medium text-surface hover:bg-ink/90 disabled:opacity-50"
                  disabled={shareLoading || !userId}
                  onClick={() => void handleShareResult()}
                  type="button"
                >
                  {shareLoading ? labels.connecting : labels.shareResult}
                </button>
              )}
                {round.roundIndex + 1}/{round.totalRounds}
              </span>
              <strong>{round.question.prompt}</strong>
              <small>{round.question.skillTag}</small>
              <div className="result-list">
                {round.question.options.map((o) => (
                  <button
                    className="secondary-button"
                    key={o.optionKey}
                    onClick={() => submitAnswer(o.optionKey)}
                    type="button"
                  >
                    {o.optionKey}. {o.text}
                  </button>
                ))}
              </div>
            </article>
          ) : null}
          {outcome ? (
            <div className="space-y-2">
              <p className="battle-outcome" role="status">
                {outcome === "win"
                  ? labels.finishedWin
                  : outcome === "lose"
                    ? labels.finishedLose
                    : labels.finishedDraw}
              </p>
              {outcome === "lose" && remediation ? (
                <a
                  className="inline-flex rounded-lg border border-ink/15 bg-paper/70 px-3 py-2 text-sm font-medium text-ink hover:bg-paper"
                  href={remediation.ctaPath}
                >
                  {labels.finishedLoseCta}
                </a>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}

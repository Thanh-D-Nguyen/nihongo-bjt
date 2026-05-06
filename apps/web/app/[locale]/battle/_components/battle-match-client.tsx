"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

import { BattleBotAvatar } from "../../../_components/battle-bot-avatar";
import { BattleCountdownOverlay } from "./battle-countdown-overlay";
import { BattlePvpOutcomeEffects } from "./battle-pvp-outcome-effects";
import { readBattlePending, useBattleRuntime } from "./battle-runtime-provider";
import { botName, localizeDifficulty, metricWidth } from "./battle-types";

function StatTile({
  label,
  tone = "dark",
  value
}: {
  label: string;
  tone?: "amber" | "dark" | "green";
  value: string;
}) {
  const toneClass = tone === "green" ? "text-leaf" : tone === "amber" ? "text-amber" : "text-ink";
  return (
    <div className="rounded-2xl border border-ink/10 bg-white/78 p-3 shadow-sm">
      <p className="text-[11px] font-bold uppercase text-muted">{label}</p>
      <p className={`mt-1 text-lg font-black ${toneClass}`}>{value}</p>
    </div>
  );
}

export function BattleMatchClient() {
  const router = useRouter();
  const {
    answerPending,
    answerResult,
    battleMode,
    cancelCountdown,
    combo,
    completeCountdown,
    connectAndStart,
    countdown,
    displayedBot,
    goToLobby,
    handleShareResult,
    labels,
    learnerDisplayName,
    locale,
    opponentName,
    opponentScore,
    outcome,
    pvpEndReason,
    pvpChallenge,
    pvpOpponentAnswered,
    remediation,
    round,
    selectedOptionKey,
    shareLoading,
    shareUrl,
    showCountdownOverlay,
    socketConnected,
    status,
    submitAnswer,
    timeLeft,
    userId,
    userScore,
    error,
    botState
  } = useBattleRuntime();

  const answerFeedback = useMemo(() => {
    if (!answerResult) return null;
    return answerResult.userCorrect
      ? labels.answerCorrect
      : labels.answerWrong.replace("{answer}", answerResult.correctOptionKey);
  }, [answerResult, labels.answerCorrect, labels.answerWrong]);

  const countdownOverlayLabels = useMemo(
    () => ({
      cancel: labels.countdownCancel,
      connected: labels.countdownConnected,
      go: labels.countdownGo,
      preparing: labels.countdownPreparing,
      reconnecting: labels.countdownReconnecting,
      starting: labels.countdownStarting,
      startingIn: labels.countdownStartingIn,
      vs: labels.vs
    }),
    [labels]
  );

  useEffect(() => {
    if (pvpChallenge) return;
    const idle =
      round === null &&
      outcome === null &&
      !showCountdownOverlay &&
      status !== labels.connecting;
    if (!idle) return;
    if (readBattlePending()) return;
    const t = window.setTimeout(() => {
      router.replace(`/${locale}/battle`);
    }, 280);
    return () => clearTimeout(t);
  }, [
    round,
    outcome,
    showCountdownOverlay,
    status,
    labels.connecting,
    locale,
    router,
    pvpChallenge
  ]);

  const roundProgress = round
    ? ((round.roundIndex + 1) / round.totalRounds) * 100
    : outcome
      ? 100
      : 0;
  const timeProgress =
    round && timeLeft !== null
      ? Math.max(0, Math.min(100, (timeLeft / round.timeLimitSec) * 100))
      : countdown !== null
        ? 35
        : 100;

  const scoreLabel =
    battleMode === "pvp"
      ? labels.pvpScoreLine
          .replace("{user}", String(userScore))
          .replace("{opponent}", opponentName ?? labels.opponent)
          .replace("{opponentScore}", String(opponentScore))
      : labels.scoreLine
          .replace("{user}", String(userScore))
          .replace("{opponent}", String(opponentScore));

  const outcomeText =
    outcome === "win"
      ? labels.finishedWin
      : outcome === "lose"
        ? labels.finishedLose
        : labels.finishedDraw;

  const isPvp = battleMode === "pvp";

  const pvpOutcomeHeadline = useMemo(() => {
    if (!isPvp || !outcome) return outcomeText;
    if (outcome === "win") {
      return pvpEndReason === "opponent_quit"
        ? labels.pvpWinByOpponentQuitTitle
        : labels.pvpVictoryTitle;
    }
    if (outcome === "lose") {
      return pvpEndReason === "self_quit"
        ? labels.pvpLossBySelfQuitTitle
        : labels.pvpComfortLoseTitle;
    }
    return outcomeText;
  }, [isPvp, outcome, outcomeText, pvpEndReason, labels]);

  const pvpOutcomeBody = useMemo(() => {
    if (!isPvp || !outcome) return null;
    if (outcome === "win") {
      return pvpEndReason === "opponent_quit"
        ? labels.pvpWinByOpponentQuitBody
        : labels.pvpVictorySubtitle;
    }
    if (outcome === "lose") {
      return pvpEndReason === "self_quit" ? labels.pvpLossBySelfQuitBody : labels.pvpComfortLoseBody;
    }
    return null;
  }, [isPvp, outcome, pvpEndReason, labels]);

  const showPvpVictoryFireworks = isPvp && outcome === "win";
  const arenaShell = isPvp
    ? "border-rose-200/50 bg-gradient-to-br from-rose-50/90 via-surface to-indigo-50/50 shadow-[0_0_0_1px_rgba(244,63,94,0.08)]"
    : "border-indigo-200/40 bg-gradient-to-br from-indigo-50/70 via-surface to-emerald-50/40 shadow-[0_0_0_1px_rgba(79,70,229,0.06)]";

  const vsStrip = isPvp ? "from-rose-600/90 to-indigo-700" : "from-indigo-700 to-emerald-700";

  const canAnswer = Boolean(round) && !answerPending && !answerResult;
  const showOutcomeActions = Boolean(outcome);
  const rematchBusy = status === labels.connecting;

  return (
    <main className="w-full pb-12">
      <BattleCountdownOverlay
        botDifficultyLabel={isPvp ? null : localizeDifficulty(labels, displayedBot.difficulty)}
        botFallback={isPvp ? labels.pvpMonogram : displayedBot.avatarFallback}
        botName={isPvp ? (opponentName ?? labels.opponent) : botName(labels, displayedBot.label)}
        botRive={isPvp ? { artboard: null, src: null, stateMachine: null } : displayedBot.rive}
        botState={botState}
        connectionStatus={socketConnected}
        countdownLabels={countdownOverlayLabels}
        countdownValue={countdown}
        onCancel={cancelCountdown}
        onComplete={completeCountdown}
        opponentPresentation={isPvp ? "human" : "bot"}
        userDisplayName={learnerDisplayName}
        visible={showCountdownOverlay}
      />

      <div className={`relative overflow-hidden rounded-[1.75rem] border p-1 ${arenaShell}`}>
        <div
          className={`absolute inset-x-0 top-0 h-1 rounded-t-[1.6rem] bg-gradient-to-r ${vsStrip} opacity-90`}
          aria-hidden
        />
        <div className="relative rounded-[1.55rem] bg-surface/85 p-4 backdrop-blur-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                {isPvp ? labels.pvpSessionBadge : labels.matchScreenEyebrow}
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
                {labels.matchScreenTitle}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {opponentName
                  ? `${labels.userLabel} ${labels.vs} ${opponentName}`
                  : labels.systemReady}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div
                aria-live="polite"
                className="min-w-[12rem] rounded-2xl border border-ink/10 bg-paper/90 px-4 py-2"
              >
                <p className="text-[10px] font-bold uppercase text-muted">{labels.finalScore}</p>
                <p className="text-lg font-bold text-ink">{scoreLabel}</p>
              </div>
              <button
                className="inline-flex min-h-10 items-center rounded-xl border border-ink/15 bg-white px-4 text-sm font-bold text-ink hover:bg-paper"
                onClick={goToLobby}
                type="button"
              >
                {labels.backToLobby}
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label={labels.questionProgress}
              tone="green"
              value={
                round
                  ? `${round.roundIndex + 1}/${round.totalRounds}`
                  : outcome
                    ? labels.finalScore
                    : labels.nextRound
              }
            />
            <StatTile
              label={labels.timerLabel}
              tone="amber"
              value={
                round && timeLeft !== null
                  ? `${timeLeft}s`
                  : countdown !== null
                    ? String(countdown)
                    : "--"
              }
            />
            <StatTile label={labels.combo} value={String(combo)} />
            <StatTile
              label={labels.opponent}
              value={isPvp ? (opponentName ?? labels.opponent) : botName(labels, displayedBot.label)}
            />
          </div>

          {isPvp ? (
            <div className="mt-5 flex flex-wrap items-center gap-4 rounded-2xl border border-rose-200/40 bg-rose-50/50 p-4">
              <div
                aria-hidden
                className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-rose-500 to-indigo-600 text-[11px] font-black leading-tight text-white"
              >
                {labels.pvpMonogram}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black uppercase tracking-wide text-rose-700">
                  {labels.pvpSessionBadge}
                </p>
                <p className="truncate text-base font-bold text-ink">{opponentName ?? labels.opponent}</p>
              </div>
            </div>
          ) : (
            <div className="mt-5 flex flex-wrap items-center gap-4 rounded-2xl border border-indigo-200/35 bg-indigo-50/40 p-4">
              <BattleBotAvatar
                className="h-14 w-14 shrink-0 rounded-2xl"
                fallback={displayedBot.avatarFallback}
                label={botName(labels, displayedBot.label)}
                rive={displayedBot.rive}
                state={botState}
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black uppercase tracking-wide text-indigo-800/80">
                  {labels.botBadge}
                </p>
                <p className="truncate text-base font-bold text-ink">{botName(labels, displayedBot.label)}</p>
                <p className="text-xs font-semibold text-muted">{labels.botStatus[botState]}</p>
              </div>
            </div>
          )}

          <section
            className={`relative mt-6 overflow-hidden rounded-2xl border border-ink/10 bg-white/90 shadow-sm ${
              round && !answerResult ? "ring-2 ring-accent/25 ring-offset-2" : ""
            }`}
          >
            <div className="border-b border-ink/10 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase text-muted">{labels.focusPanel}</p>
                  <h2 className="mt-1 text-lg font-bold text-ink">{labels.arenaTitle}</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {showOutcomeActions ? (
                    isPvp ? (
                      <Link
                        className="inline-flex min-h-10 items-center rounded-xl bg-ink px-4 text-sm font-bold text-surface hover:bg-ink/90"
                        href={`/${locale}/battle`}
                      >
                        {labels.backToLobby}
                      </Link>
                    ) : (
                      <>
                        <button
                          className="inline-flex min-h-10 items-center rounded-xl bg-leaf px-4 text-sm font-bold text-white hover:bg-leaf/90 disabled:opacity-50"
                          disabled={!userId || rematchBusy}
                          onClick={connectAndStart}
                          type="button"
                        >
                          {rematchBusy ? labels.connecting : labels.rematch}
                        </button>
                        <Link
                          className="inline-flex min-h-10 items-center rounded-xl border border-ink/20 bg-white px-4 text-sm font-bold text-ink hover:bg-paper"
                          href={`/${locale}/battle`}
                        >
                          {labels.backToLobby}
                        </Link>
                      </>
                    )
                  ) : null}
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <span className="sr-only">{labels.progressBarLabel}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-ink/10">
                    <div
                      className="h-full rounded-full bg-leaf"
                      style={{ width: metricWidth(roundProgress) }}
                    />
                  </div>
                </div>
                <div>
                  <span className="sr-only">{labels.timeBarLabel}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-ink/10">
                    <div
                      className="h-full rounded-full bg-amber"
                      style={{ width: metricWidth(timeProgress) }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-5">
              {error ? (
                <p
                  className="mb-4 rounded-xl border border-sakura/20 bg-sakura-soft px-3 py-2 text-sm font-bold text-sakura"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}
              {status && !outcome ? (
                <p
                  className="mb-4 rounded-xl border border-ink/10 bg-paper px-3 py-2 text-sm font-bold text-muted"
                  role="status"
                >
                  {status}
                </p>
              ) : null}

              {!round && !outcome ? (
                <div className="grid min-h-[12rem] place-items-center rounded-2xl border border-dashed border-ink/12 bg-paper/70 p-6 text-center">
                  <p className="max-w-md text-sm font-semibold leading-6 text-muted">
                    {showCountdownOverlay ? labels.countdownPreparing : labels.notStartedHint}
                  </p>
                </div>
              ) : null}

              {round ? (
                <article className="space-y-4" key={round.roundIndex}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-full border border-ink/10 bg-paper px-3 py-1 text-xs font-black text-muted">
                      {round.roundIndex + 1}/{round.totalRounds}
                    </span>
                    <span className="rounded-full border border-leaf/20 bg-leaf/10 px-3 py-1 text-xs font-black text-leaf">
                      {labels.roundSkill.replace("{skill}", round.question.skillTag)}
                    </span>
                  </div>
                  <p className="rounded-2xl border border-ink/10 bg-paper/70 p-4 text-base font-semibold leading-7 text-ink sm:text-lg">
                    {round.question.prompt}
                  </p>
                  {answerPending ? (
                    <p className="text-sm font-bold text-muted" role="status">
                      {battleMode === "pvp" ? labels.pvpWaiting : labels.answerWaiting}
                    </p>
                  ) : null}
                  {battleMode === "pvp" && pvpOpponentAnswered && !answerResult ? (
                    <p
                      className="rounded-xl border border-accent/20 bg-accent/5 px-3 py-2 text-sm font-bold text-accent"
                      role="status"
                    >
                      {labels.pvpOpponentAnswered}
                    </p>
                  ) : null}
                  {answerFeedback ? (
                    <p
                      className={`rounded-xl border px-3 py-2 text-sm font-black ${
                        answerResult?.userCorrect
                          ? "border-leaf/20 bg-leaf-soft text-leaf"
                          : "border-sakura/20 bg-sakura-soft text-sakura"
                      }`}
                      role="status"
                    >
                      {answerFeedback}
                    </p>
                  ) : null}
                  <div className="grid gap-3 sm:grid-cols-2">
                    {round.question.options.map((option) => {
                      const picked = selectedOptionKey === option.optionKey;
                      const correct = answerResult?.correctOptionKey === option.optionKey;
                      return (
                        <button
                          className={`min-h-16 rounded-2xl border px-4 py-3 text-left text-sm font-bold leading-6 transition disabled:cursor-not-allowed ${
                            correct
                              ? "border-leaf/30 bg-leaf-soft text-leaf"
                              : picked
                                ? "border-ink/30 bg-paper text-ink"
                                : "border-ink/10 bg-white text-ink hover:bg-paper"
                          }`}
                          disabled={!canAnswer}
                          key={option.optionKey}
                          onClick={() => submitAnswer(option.optionKey)}
                          type="button"
                        >
                          <span className="mr-2 text-muted">{option.optionKey}.</span>
                          {option.text}
                        </button>
                      );
                    })}
                  </div>
                </article>
              ) : null}

              {outcome ? (
                <div className="relative overflow-hidden rounded-2xl border border-ink/10 bg-paper/70 p-4">
                  <BattlePvpOutcomeEffects fireworks={showPvpVictoryFireworks} />
                  <p className="relative z-[2] text-lg font-black text-ink" role="status">
                    {isPvp ? pvpOutcomeHeadline : outcomeText}
                  </p>
                  {isPvp && pvpOutcomeBody ? (
                    <p className="relative z-[2] mt-2 text-sm font-semibold leading-relaxed text-muted">
                      {pvpOutcomeBody}
                    </p>
                  ) : null}
                  <p className="relative z-[2] mt-2 text-sm font-bold text-muted">
                    {labels.finalScore}: {userScore} - {opponentScore}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {isPvp ? (
                      <Link
                        className="inline-flex min-h-10 items-center rounded-xl bg-ink px-4 text-sm font-bold text-surface hover:bg-ink/90"
                        href={`/${locale}/battle`}
                      >
                        {labels.backToLobby}
                      </Link>
                    ) : (
                      <button
                        className="inline-flex min-h-10 items-center rounded-xl bg-leaf px-4 text-sm font-bold text-white hover:bg-leaf/90 disabled:opacity-50"
                        disabled={!userId || rematchBusy}
                        onClick={connectAndStart}
                        type="button"
                      >
                        {rematchBusy ? labels.connecting : labels.rematch}
                      </button>
                    )}
                    {!isPvp && outcome === "lose" && remediation ? (
                      <a
                        className="inline-flex min-h-10 items-center rounded-xl border border-ink/15 bg-white px-3 text-sm font-bold text-ink hover:bg-paper"
                        href={remediation.ctaPath}
                      >
                        {labels.finishedLoseCta}
                      </a>
                    ) : null}
                    {labels.shareResult && !shareUrl ? (
                      <button
                        className="inline-flex min-h-10 items-center rounded-xl border border-ink/20 bg-white px-4 text-sm font-bold text-ink hover:bg-paper disabled:opacity-50"
                        disabled={shareLoading || !userId}
                        onClick={() => void handleShareResult()}
                        type="button"
                      >
                        {shareLoading ? labels.connecting : labels.shareResult}
                      </button>
                    ) : null}
                  </div>
                  {labels.sharePrivacyNotice && labels.shareResult && !shareUrl ? (
                    <p className="mt-3 text-xs font-semibold leading-5 text-muted">
                      {labels.sharePrivacyNotice}
                    </p>
                  ) : null}
                  {shareUrl ? (
                    <p className="mt-3 text-sm font-bold text-leaf">{labels.shareSuccess}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>

          <p className="mt-4 text-center text-xs font-semibold text-muted">
            <Link className="text-accent underline-offset-2 hover:underline" href={`/${locale}/battle`}>
              {labels.backToLobby}
            </Link>
            {" · "}
            <span>{labels.lobbyTitle}</span>
          </p>
        </div>
      </div>
    </main>
  );
}

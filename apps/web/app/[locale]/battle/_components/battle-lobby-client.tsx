"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { BattleBotAnimationState } from "@nihongo-bjt/shared";
import { Badge, PageHeader } from "@nihongo-bjt/ui";

import { BattleBotAvatar } from "../../../_components/battle-bot-avatar";
import { BotDetailPopover } from "./bot-detail-popover";
import { BattleLobbyLeaderboardPanel } from "./battle-lobby-leaderboard";
import { useBattleRuntime } from "./battle-runtime-provider";
import {
  botName,
  localizeDifficulty,
  localizeVocab,
  personaLabel,
  styleFor,
  type BattleBotStageProfile,
  type BattlePageLabels
} from "./battle-types";

type BotPopoverState = { bot: BattleBotStageProfile; rect: DOMRect } | null;

type StartBotButtonProps = {
  labels: BattlePageLabels;
  onStart: () => void;
  startBusy: boolean;
  startDisabled: boolean;
};

function StartBotButton({
  labels,
  onStart,
  startBusy,
  startDisabled
}: StartBotButtonProps) {
  return (
    <button
      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-5 text-sm font-black text-white shadow-md shadow-indigo-500/20 transition hover:from-indigo-700 hover:to-blue-700 hover:shadow-lg hover:shadow-indigo-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none"
      disabled={startDisabled || startBusy}
      onClick={onStart}
      title={startDisabled ? labels.startBotDisabledHint : undefined}
      type="button"
    >
      {startBusy ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden />
          {labels.connecting}
        </>
      ) : (
        <>
          <span aria-hidden>⚔️</span>
          {labels.start}
        </>
      )}
    </button>
  );
}

type BotDrillSelectorProps = {
  labels: BattlePageLabels;
  botChoices: BattleBotStageProfile[];
  botChoicesLoading: boolean;
  botKey: string;
  botState: BattleBotAnimationState;
  displayedBot: BattleBotStageProfile;
  startDisabled: boolean;
  startBusy: boolean;
  pickBot: (bot: BattleBotStageProfile) => void;
  connectAndStart: () => void;
  openBot: (bot: BattleBotStageProfile, el: HTMLElement) => void;
  botRowEnter: (bot: BattleBotStageProfile, el: HTMLElement) => void;
  rowLeave: () => void;
  pvpMatchInProgress: boolean;
  opponentName: string | null;
  matchHref: string;
};

function BotDrillSelector({
  labels,
  botChoices,
  botChoicesLoading,
  botKey,
  botState,
  displayedBot,
  startDisabled,
  startBusy,
  pickBot,
  connectAndStart,
  openBot,
  botRowEnter,
  rowLeave,
  pvpMatchInProgress,
  opponentName,
  matchHref
}: BotDrillSelectorProps) {
  return (
    <section className="flex flex-col overflow-hidden rounded-[1.5rem] border border-ink/10 bg-surface shadow-sm">
      <div className="border-b border-ink/10 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-black text-ink">{labels.chooseArena}</h2>
          <span className="rounded-full border border-leaf/20 bg-leaf/10 px-2.5 py-0.5 text-[11px] font-black text-leaf">
            {labels.lobbyOnline.replace("{count}", String(botChoices.length))}
          </span>
        </div>
        <p className="mt-1.5 text-xs font-semibold text-muted">
          {pvpMatchInProgress ? labels.matchActiveBanner : labels.pickBot}
        </p>
      </div>

      {botChoicesLoading ? (
        <div className="space-y-2 p-3" aria-busy="true" aria-label={labels.connecting}>
          {[0, 1, 2, 3].map((i) => (
            <div className="grid grid-cols-[40px_1fr_auto] items-center gap-2.5 rounded-xl border border-ink/5 p-2" key={i}>
              <div className="battle-skeleton h-10 w-10 rounded-lg" />
              <div className="space-y-1.5">
                <div className="battle-skeleton h-3.5 w-24 rounded" />
                <div className="battle-skeleton h-2.5 w-16 rounded" />
              </div>
              <div className="battle-skeleton h-5 w-12 rounded-full" />
            </div>
          ))}
        </div>
      ) : null}

      <div className="space-y-2 p-3">
        {botChoices.map((bot) => {
          const selected = bot.key === botKey;
          const style = styleFor(bot.styleToken);
          return (
            <button
              className={`battle-bot-card grid w-full grid-cols-[40px_1fr_auto] items-center gap-2.5 rounded-xl border p-2.5 text-left transition ${
                selected
                  ? `battle-bot-card-selected ${style.border} bg-accent/5 shadow-sm`
                  : "border-ink/10 bg-surface/75 hover:bg-paper hover:shadow-sm"
              }`}
              key={bot.key}
              onClick={(e) => {
                pickBot(bot);
                openBot(bot, e.currentTarget);
              }}
              onMouseEnter={(e) => botRowEnter(bot, e.currentTarget)}
              onMouseLeave={rowLeave}
              type="button"
            >
              <div className="relative">
                <BattleBotAvatar
                  className="h-10 w-10 rounded-lg"
                  fallback={bot.avatarFallback}
                  rive={bot.rive}
                  state={selected ? botState : "idle"}
                  variant="card"
                />
                {selected ? (
                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-accent" aria-hidden />
                ) : null}
              </div>
              <span className="min-w-0">
                <span className="block truncate text-sm font-black text-ink">
                  {botName(labels, bot.label)}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-muted">
                  <span className="truncate">{localizeVocab(labels, bot.vocabularyLevel) ?? labels.battleDeck}</span>
                  <span className={`inline-block h-1 w-1 shrink-0 rounded-full ${style.accent}`} aria-hidden />
                  <span className="shrink-0">{localizeDifficulty(labels, bot.difficulty)}</span>
                </span>
              </span>
              <span
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black tabular-nums ${
                  selected
                    ? "border-accent/25 bg-accent/10 text-accent"
                    : "border-ink/10 bg-paper text-muted"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${style.accent}`} aria-hidden />
                {bot.accuracyPct ?? "--"}%
              </span>
            </button>
          );
        })}
      </div>

      <div className="border-t border-ink/10 p-3">
        {pvpMatchInProgress ? (
          <>
            <p className="mb-2 text-[11px] font-black uppercase text-muted">
              {labels.pvpSessionBadge}
            </p>
            <p className="mb-3 truncate text-sm font-bold text-ink">
              {opponentName?.trim()
                ? `${labels.userLabel} ${labels.vs} ${opponentName}`
                : labels.matchActiveBanner}
            </p>
            <Link
              className="flex min-h-11 w-full items-center justify-center rounded-xl bg-ink px-4 text-sm font-black text-surface transition hover:bg-ink/90"
              href={matchHref}
            >
              {labels.enterActiveMatch}
            </Link>
          </>
        ) : (
          <>
            <div className="flex min-h-12 items-center gap-2 rounded-xl border border-ink/10 bg-paper/70 px-3 py-2">
              <BattleBotAvatar
                className="h-10 w-10 shrink-0 rounded-lg"
                fallback={displayedBot.avatarFallback}
                label={botName(labels, displayedBot.label)}
                rive={displayedBot.rive}
                state={botState}
                variant="card"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink">
                  {botName(labels, displayedBot.label)}
                </p>
                <p className="truncate text-[11px] text-muted">
                  {localizeDifficulty(labels, displayedBot.difficulty) ?? labels.battleDeck}
                </p>
              </div>
            </div>
            <div className="mt-3">
              <StartBotButton
                labels={labels}
                onStart={connectAndStart}
                startBusy={startBusy}
                startDisabled={startDisabled}
              />
            </div>
            {startDisabled ? (
              <p className="mt-2 text-xs font-semibold leading-5 text-muted" role="status">
                {labels.startBotDisabledHint}
              </p>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

export function BattleLobbyClient() {
  const {
    battleMode,
    botChoices,
    botChoicesLoading,
    botKey,
    botState,
    connectAndStart,
    isMatchUiActive,
    labels,
    locale,
    opponentName,
    pickBot,
    socketConnected,
    status,
    userId,
    displayedBot,
    setSelectedConfigId,
    setActiveGameType
  } = useBattleRuntime();

  // Keep standard BJT bot rounds active with no arcade config selected.
  useEffect(() => {
    setSelectedConfigId(null);
    setActiveGameType(null);
  }, [setSelectedConfigId, setActiveGameType]);

  const [detail, setDetail] = useState<BotPopoverState>(null);
  const hoverOpenTimer = useRef<number | null>(null);
  const hoverCloseTimer = useRef<number | null>(null);

  const cancelHoverClose = useCallback(() => {
    if (hoverCloseTimer.current) {
      clearTimeout(hoverCloseTimer.current);
      hoverCloseTimer.current = null;
    }
  }, []);

  const scheduleHoverClose = useCallback(() => {
    cancelHoverClose();
    hoverCloseTimer.current = window.setTimeout(() => {
      setDetail(null);
    }, 220);
  }, [cancelHoverClose]);

  const statLabels = useMemo(
    () => ({
      accuracy: labels.popoverAccuracy,
      speed: labels.popoverSpeed,
      vocab: labels.popoverVocab
    }),
    [labels.popoverAccuracy, labels.popoverSpeed, labels.popoverVocab]
  );

  useEffect(() => {
    return () => {
      if (hoverOpenTimer.current) clearTimeout(hoverOpenTimer.current);
      if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
    };
  }, []);

  const liveStatus = socketConnected ? labels.lobbyConnectionOnline : labels.lobbyConnectionOffline;
  const startDisabled = !userId || !socketConnected || botChoicesLoading;
  const startBusy = status === labels.connecting;
  const pvpMatchInProgress = battleMode === "pvp" && isMatchUiActive;

  function openBot(bot: BattleBotStageProfile, el: HTMLElement) {
    cancelHoverClose();
    setDetail({ bot, rect: el.getBoundingClientRect() });
  }

  function botRowEnter(bot: BattleBotStageProfile, el: HTMLElement) {
    if (hoverOpenTimer.current) clearTimeout(hoverOpenTimer.current);
    cancelHoverClose();
    hoverOpenTimer.current = window.setTimeout(() => {
      openBot(bot, el);
    }, 300);
  }

  function rowLeave() {
    if (hoverOpenTimer.current) {
      clearTimeout(hoverOpenTimer.current);
      hoverOpenTimer.current = null;
    }
    scheduleHoverClose();
  }

  return (
    <main className="w-full pb-12">
      {detail ? (
        <BotDetailPopover
          accuracyPct={detail.bot.accuracyPct}
          avatarFallback={detail.bot.avatarFallback}
          battleRecordHint={labels.botPopoverBattleRecordHint}
          difficultyKey={detail.bot.difficulty}
          difficultyLabel={localizeDifficulty(labels, detail.bot.difficulty)}
          maxDelayMs={detail.bot.maxDelayMs}
          minDelayMs={detail.bot.minDelayMs}
          name={botName(labels, detail.bot.label)}
          onClose={() => setDetail(null)}
          onHoverGroupEnter={cancelHoverClose}
          onHoverGroupLeave={scheduleHoverClose}
          persona={personaLabel(labels, detail.bot.persona)}
          rive={detail.bot.rive}
          state={detail.bot.key === botKey ? botState : "idle"}
          statLabels={statLabels}
          styleToken={detail.bot.styleToken}
          triggerRect={detail.rect}
          vocabularyLabel={localizeVocab(labels, detail.bot.vocabularyLevel)}
        />
      ) : null}

      <PageHeader
        eyebrow={labels.eyebrow}
        title={labels.title}
        description={labels.pickBot}
        actions={
          <Badge className="min-h-9 gap-2 px-3 shadow-sm">
            <span className={`h-2.5 w-2.5 rounded-full ring-2 ${socketConnected ? "bg-leaf ring-leaf/20" : "bg-amber ring-amber/20"}`} />
            {liveStatus}
          </Badge>
        }
      />

      {isMatchUiActive ? (
        <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-accent/25 bg-accent/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-bold text-ink">{labels.matchActiveBanner}</p>
          <Link
            className="inline-flex min-h-10 items-center justify-center rounded-xl bg-ink px-4 text-sm font-bold text-surface hover:bg-ink/90"
            href={`/${locale}/battle/match`}
          >
            {labels.enterActiveMatch}
          </Link>
        </div>
      ) : null}

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:items-start">
        <BotDrillSelector
          botChoices={botChoices}
          botChoicesLoading={botChoicesLoading}
          botKey={botKey}
          botRowEnter={botRowEnter}
          botState={botState}
          connectAndStart={connectAndStart}
          displayedBot={displayedBot}
          labels={labels}
          matchHref={`/${locale}/battle/match`}
          openBot={openBot}
          opponentName={opponentName}
          pickBot={pickBot}
          pvpMatchInProgress={pvpMatchInProgress}
          rowLeave={rowLeave}
          startBusy={startBusy}
          startDisabled={startDisabled}
        />

        <BattleLobbyLeaderboardPanel className="mt-0" labels={labels} />
      </div>
    </main>
  );
}

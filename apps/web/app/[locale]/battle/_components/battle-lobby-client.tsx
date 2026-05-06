"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import type { BattleBotAnimationState } from "@nihongo-bjt/shared";
import { Badge, Button, Input, PageHeader } from "@nihongo-bjt/ui";

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
  type BattlePageLabels,
  type PresenceUser
} from "./battle-types";
import { UserPresencePopover } from "./user-presence-popover";

type PopoverState =
  | { kind: "bot"; bot: BattleBotStageProfile; rect: DOMRect }
  | { kind: "user"; user: PresenceUser; rect: DOMRect }
  | null;

type LobbyRosterColumnProps = {
  variant: "desktop" | "drawer";
  labels: BattlePageLabels;
  battleMode: "bot" | "pvp";
  botChoices: BattleBotStageProfile[];
  botChoicesLoading: boolean;
  botKey: string;
  botState: BattleBotAnimationState;
  presence: PresenceUser[];
  userId: string | null | undefined;
  displayedBot: BattleBotStageProfile;
  totalOpponents: number;
  startDisabled: boolean;
  startBusy: boolean;
  pickBot: (bot: BattleBotStageProfile) => void;
  connectAndStart: () => void;
  challengeUser: (targetUserId: string) => void;
  openBot: (bot: BattleBotStageProfile, el: HTMLElement) => void;
  botRowEnter: (bot: BattleBotStageProfile, el: HTMLElement) => void;
  openUser: (user: PresenceUser, el: HTMLElement) => void;
  userRowEnter: (user: PresenceUser, el: HTMLElement) => void;
  rowLeave: () => void;
  onCloseDrawer?: () => void;
  onAfterBattleStart?: () => void;
  /** PvP match running — hide bot arena / start, show return-to-match */
  pvpMatchInProgress: boolean;
  opponentName: string | null;
  matchHref: string;
};

function LobbyRosterColumn({
  variant,
  labels,
  battleMode,
  botChoices,
  botChoicesLoading,
  botKey,
  botState,
  presence,
  userId,
  displayedBot,
  totalOpponents,
  startDisabled,
  startBusy,
  pickBot,
  connectAndStart,
  challengeUser,
  openBot,
  botRowEnter,
  openUser,
  userRowEnter,
  rowLeave,
  onCloseDrawer,
  onAfterBattleStart,
  pvpMatchInProgress,
  opponentName,
  matchHref
}: LobbyRosterColumnProps) {
  const sectionClass =
    variant === "desktop"
      ? "hidden min-h-[22rem] rounded-[1.5rem] border border-ink/10 bg-surface shadow-sm lg:flex lg:min-h-[28rem] lg:flex-col"
      : "flex h-full min-h-0 flex-col bg-surface";

  return (
    <section className={sectionClass}>
      <div className="border-b border-ink/10 p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-black text-ink">{labels.lobbyRoster}</h2>
          <div className="flex shrink-0 items-center gap-2">
            {variant === "drawer" ? (
              <button
                className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-ink/15 bg-white text-sm font-black text-ink hover:bg-paper"
                onClick={onCloseDrawer}
                type="button"
              >
                {labels.lobbyCloseRoster}
              </button>
            ) : null}
            <span className="rounded-full border border-leaf/20 bg-leaf/10 px-2.5 py-0.5 text-[11px] font-black text-leaf">
              {labels.lobbyOnline.replace("{count}", String(totalOpponents))}
            </span>
          </div>
        </div>
        <p className="mt-2 text-xs font-semibold text-muted">
          {pvpMatchInProgress ? labels.matchActiveBanner : labels.pickBot}
        </p>
      </div>
      {botChoicesLoading ? (
        <p className="p-3 text-xs font-bold text-muted">{labels.connecting}</p>
      ) : null}
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3">
        {botChoices.map((bot) => {
          const selected = bot.key === botKey;
          const style = styleFor(bot.styleToken);
          return (
            <button
              className={`grid w-full grid-cols-[40px_1fr_auto] items-center gap-2.5 rounded-xl border p-2 text-left transition hover:bg-paper ${
                selected ? `${style.border} bg-paper shadow-sm` : "border-ink/10 bg-white/75"
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
              <BattleBotAvatar
                className="h-10 w-10 rounded-lg"
                fallback={bot.avatarFallback}
                rive={bot.rive}
                state={selected ? botState : "idle"}
                variant="card"
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-black text-ink">
                  {botName(labels, bot.label)}
                </span>
                <span className="mt-0.5 block truncate text-[11px] font-semibold text-muted">
                  {localizeVocab(labels, bot.vocabularyLevel) ?? labels.battleDeck}
                </span>
              </span>
              <span className="flex items-center gap-1 rounded-full border border-ink/10 bg-white px-2 py-0.5 text-[10px] font-black text-muted">
                <span className={`h-1.5 w-1.5 rounded-full ${style.accent}`} aria-hidden />
                {bot.accuracyPct ?? "--"}%
              </span>
            </button>
          );
        })}

        {presence.length === 0 ? (
          <p className="rounded-xl border border-dashed border-ink/10 bg-paper p-3 text-xs font-semibold leading-5 text-muted">
            {labels.lobbyConnectionOffline}
          </p>
        ) : null}
        {presence.map((user) => {
          const mine = user.userId === userId;
          const name = user.displayName || labels.userLabel;
          return (
            <div
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-ink/10 bg-paper p-2 transition hover:bg-white"
              key={user.userId}
              onClick={(e) => openUser(user, e.currentTarget)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openUser(user, e.currentTarget as HTMLElement);
                }
              }}
              onMouseEnter={(e) => userRowEnter(user, e.currentTarget)}
              onMouseLeave={rowLeave}
              role="button"
              tabIndex={0}
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-leaf/10 text-[10px] font-black text-leaf">
                {name.slice(0, 2).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black text-ink">{name}</span>
                <span className="text-[11px] font-semibold text-muted">
                  {mine ? labels.userLabel : labels.lobbyConnectionOnline}
                </span>
              </span>
              {!mine ? (
                <button
                  className="rounded-lg border border-ink/10 bg-white px-2 py-0.5 text-[11px] font-black text-ink hover:bg-ink/5"
                  onClick={(e) => {
                    e.stopPropagation();
                    challengeUser(user.userId);
                  }}
                  type="button"
                >
                  {labels.lobbyChallenge}
                </button>
              ) : null}
            </div>
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
              className="flex w-full min-h-11 items-center justify-center rounded-xl bg-ink px-4 text-sm font-black text-surface transition hover:bg-ink/90"
              href={matchHref}
            >
              {labels.enterActiveMatch}
            </Link>
          </>
        ) : (
          <>
            <p className="mb-2 text-[11px] font-black uppercase text-muted">
              {battleMode === "pvp" ? labels.pvpSessionBadge : labels.chooseArena}
            </p>
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
            <button
              className="mt-3 flex w-full min-h-11 items-center justify-center rounded-xl bg-ink px-4 text-sm font-black text-surface transition hover:bg-ink/90 disabled:pointer-events-none disabled:opacity-45"
              disabled={startDisabled || startBusy}
              onClick={() => {
                connectAndStart();
                onAfterBattleStart?.();
              }}
              title={startDisabled ? labels.startBotDisabledHint : undefined}
              type="button"
            >
              {startBusy ? labels.connecting : labels.start}
            </button>
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
    challengeUser,
    chatText,
    connectAndStart,
    declinePvpChallenge,
    acceptPvpChallenge,
    isMatchUiActive,
    labels,
    lobbyMessages,
    lobbyNotice,
    locale,
    opponentName,
    pickBot,
    presence,
    pvpChallenge,
    sendLobbyMessage,
    setChatText,
    socketConnected,
    status,
    userId,
    displayedBot
  } = useBattleRuntime();

  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const didInitialChatScrollRef = useRef(false);
  const pvpDialogTitleId = useId();
  const rosterSheetId = useId();
  const [rosterOpen, setRosterOpen] = useState(false);
  const [detail, setDetail] = useState<PopoverState>(null);
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

  const popoverStatsLabels = useMemo(
    () => ({
      couldNotLoad: labels.popoverStatsCouldNotLoad,
      heading: labels.popoverStatsHeading,
      loading: labels.popoverStatsLoading,
      matchesLine: labels.popoverStatsMatchesLine,
      wldrLine: labels.popoverStatsWLDR,
      winRateLine: labels.popoverStatsWinRateLine
    }),
    [
      labels.popoverStatsCouldNotLoad,
      labels.popoverStatsHeading,
      labels.popoverStatsLoading,
      labels.popoverStatsMatchesLine,
      labels.popoverStatsWLDR,
      labels.popoverStatsWinRateLine
    ]
  );

  useEffect(() => {
    const root = chatScrollRef.current;
    if (!root || lobbyMessages.length === 0) {
      didInitialChatScrollRef.current = false;
      return;
    }

    const last = lobbyMessages[lobbyMessages.length - 1];
    if (!last) return;

    const distanceFromBottom = root.scrollHeight - root.scrollTop - root.clientHeight;
    const nearBottom = distanceFromBottom < 72;
    const shouldPin = !didInitialChatScrollRef.current || last.userId === userId || nearBottom;

    if (!shouldPin) return;

    didInitialChatScrollRef.current = true;
    requestAnimationFrame(() => {
      root.scrollTop = root.scrollHeight;
    });
  }, [lobbyMessages, userId]);

  useEffect(() => {
    return () => {
      if (hoverOpenTimer.current) clearTimeout(hoverOpenTimer.current);
      if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
    };
  }, []);

  const liveStatus = socketConnected ? labels.lobbyConnectionOnline : labels.lobbyConnectionOffline;

  const startDisabled = !userId || !socketConnected || botChoicesLoading;
  const startBusy = status === labels.connecting;

  function openBot(bot: BattleBotStageProfile, el: HTMLElement) {
    cancelHoverClose();
    setDetail({ kind: "bot", bot, rect: el.getBoundingClientRect() });
  }

  function openUser(user: PresenceUser, el: HTMLElement) {
    cancelHoverClose();
    setDetail({ kind: "user", user, rect: el.getBoundingClientRect() });
  }

  function botRowEnter(bot: BattleBotStageProfile, el: HTMLElement) {
    if (hoverOpenTimer.current) clearTimeout(hoverOpenTimer.current);
    cancelHoverClose();
    hoverOpenTimer.current = window.setTimeout(() => {
      openBot(bot, el);
    }, 300);
  }

  function userRowEnter(user: PresenceUser, el: HTMLElement) {
    if (hoverOpenTimer.current) clearTimeout(hoverOpenTimer.current);
    cancelHoverClose();
    hoverOpenTimer.current = window.setTimeout(() => {
      openUser(user, el);
    }, 300);
  }

  function rowLeave() {
    if (hoverOpenTimer.current) {
      clearTimeout(hoverOpenTimer.current);
      hoverOpenTimer.current = null;
    }
    scheduleHoverClose();
  }

  const totalOpponents = botChoices.length + presence.length;
  const rosterCountDisplay = totalOpponents > 99 ? "99+" : String(totalOpponents);

  useEffect(() => {
    if (!rosterOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [rosterOpen]);

  useEffect(() => {
    if (!rosterOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setRosterOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [rosterOpen]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    function closeIfDesktop() {
      if (mq.matches) setRosterOpen(false);
    }
    mq.addEventListener("change", closeIfDesktop);
    closeIfDesktop();
    return () => mq.removeEventListener("change", closeIfDesktop);
  }, []);

  const pvpMatchInProgress = battleMode === "pvp" && isMatchUiActive;

  const rosterColumnProps: Omit<LobbyRosterColumnProps, "variant"> = {
    battleMode,
    botChoices,
    botChoicesLoading,
    botKey,
    botState,
    challengeUser,
    connectAndStart,
    displayedBot,
    labels,
    matchHref: `/${locale}/battle/match`,
    openBot,
    botRowEnter,
    openUser,
    opponentName,
    userRowEnter,
    pickBot,
    presence,
    pvpMatchInProgress,
    rowLeave,
    startBusy,
    startDisabled,
    totalOpponents,
    userId
  };

  return (
    <main className="w-full pb-12">
      {pvpChallenge ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div
            aria-labelledby={pvpDialogTitleId}
            aria-modal="true"
            className="mx-4 w-full max-w-sm rounded-2xl border border-ink/10 bg-surface p-6 shadow-xl"
            role="dialog"
          >
            <h2 className="text-lg font-black text-ink" id={pvpDialogTitleId}>
              {labels.pvpChallengeTitle}
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-muted">
              {labels.pvpChallengeBody.replace(
                "{name}",
                pvpChallenge.fromDisplayName || labels.userLabel
              )}
            </p>
            <div className="mt-5 flex gap-3">
              <button
                className="flex-1 rounded-xl bg-leaf px-4 py-2.5 text-sm font-black text-white transition hover:bg-leaf/90"
                onClick={acceptPvpChallenge}
                type="button"
              >
                {labels.pvpAccept}
              </button>
              <button
                className="flex-1 rounded-xl border border-ink/15 bg-white px-4 py-2.5 text-sm font-black text-ink transition hover:bg-paper"
                onClick={declinePvpChallenge}
                type="button"
              >
                {labels.pvpDecline}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {detail?.kind === "bot" ? (
        <BotDetailPopover
          accuracyPct={detail.bot.accuracyPct}
          avatarFallback={detail.bot.avatarFallback}
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
          battleRecordHint={labels.botPopoverBattleRecordHint}
        />
      ) : null}

      {detail?.kind === "user" ? (
        <UserPresencePopover
          displayName={detail.user.displayName || labels.userLabel}
          isSelf={detail.user.userId === userId}
          labels={{
            challenge: labels.lobbyChallenge,
            lobbyOnline: labels.lobbyConnectionOnline,
            member: labels.userPopoverMember,
            userLabel: labels.userLabel
          }}
          onChallenge={() => challengeUser(detail.user.userId)}
          onClose={() => setDetail(null)}
          onHoverGroupEnter={cancelHoverClose}
          onHoverGroupLeave={scheduleHoverClose}
          statsLabels={popoverStatsLabels}
          targetUserId={detail.user.userId}
          triggerRect={detail.rect}
        />
      ) : null}

      <PageHeader
        eyebrow={labels.eyebrow}
        title={labels.title}
        description={labels.pickBot}
        actions={
          <Badge className="min-h-9 gap-2 px-3">
            <span className={`h-2 w-2 rounded-full ${socketConnected ? "bg-leaf" : "bg-amber"}`} />
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

      <button
        aria-hidden={!rosterOpen}
        className={`fixed inset-0 z-30 bg-ink/40 transition-opacity duration-200 lg:hidden ${
          rosterOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setRosterOpen(false)}
        tabIndex={rosterOpen ? 0 : -1}
        type="button"
      />
      <aside
        aria-hidden={!rosterOpen}
        aria-label={labels.lobbyRoster}
        aria-modal={rosterOpen || undefined}
        className={`fixed inset-y-0 left-0 z-40 flex w-[min(22rem,calc(100vw-1rem))] max-w-full flex-col rounded-r-[1.5rem] border border-ink/10 border-l-0 bg-surface shadow-xl transition-transform duration-200 ease-out will-change-transform lg:hidden ${
          rosterOpen ? "translate-x-0" : "pointer-events-none -translate-x-full"
        }`}
        id={rosterSheetId}
        role="dialog"
      >
        <LobbyRosterColumn
          {...rosterColumnProps}
          onAfterBattleStart={() => setRosterOpen(false)}
          onCloseDrawer={() => setRosterOpen(false)}
          variant="drawer"
        />
      </aside>

      <div className="relative mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <section className="flex min-h-[22rem] flex-col rounded-[1.5rem] border border-ink/10 bg-surface shadow-sm lg:min-h-[28rem]">
          <div className="border-b border-ink/10 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <button
                  aria-controls={rosterSheetId}
                  aria-expanded={rosterOpen}
                  aria-label={labels.lobbyOpenRoster}
                  className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-ink/15 bg-paper shadow-sm outline-none ring-offset-2 transition hover:bg-white focus-visible:ring-2 focus-visible:ring-accent lg:hidden"
                  onClick={() => setRosterOpen((open) => !open)}
                  type="button"
                >
                  <span
                    className="absolute inset-[3px] rounded-full border border-leaf/30 bg-leaf/10"
                    aria-hidden
                  />
                  <span className="relative text-[12px] font-black tabular-nums text-leaf">
                    {rosterCountDisplay}
                  </span>
                </button>
                <h2 className="min-w-0 truncate text-sm font-black text-ink">
                  {labels.lobbyTitle}
                </h2>
              </div>
              {lobbyNotice ? (
                <span className="max-w-[40%] shrink-0 truncate rounded-full bg-paper px-2 py-0.5 text-[10px] font-bold text-ink sm:max-w-[55%]">
                  {lobbyNotice}
                </span>
              ) : null}
            </div>
          </div>
          <div
            className="flex-1 space-y-2 overflow-y-auto p-3"
            aria-live="polite"
            ref={chatScrollRef}
          >
            {lobbyMessages.length === 0 ? (
              <p className="rounded-xl border border-dashed border-ink/15 bg-paper p-3 text-xs font-semibold leading-5 text-muted">
                {labels.lobbyEmpty}
              </p>
            ) : (
              lobbyMessages.map((message) => {
                const mine = message.userId === userId;
                const isBot = message.kind === "bot";
                const timeStr = new Date(message.createdAt).toLocaleTimeString(
                  locale === "ja" ? "ja-JP" : "vi-VN",
                  { hour: "2-digit", minute: "2-digit" }
                );
                return (
                  <div
                    className={`flex ${mine ? "justify-end" : "justify-start"} px-0.5`}
                    key={message.id}
                  >
                    <article
                      className={`relative max-w-[min(92%,28rem)] px-4 py-2.5 shadow-sm ${
                        mine
                          ? "rounded-[1.35rem] rounded-br-md bg-gradient-to-br from-ink via-ink to-ink/92 text-surface ring-1 ring-ink/20"
                          : isBot
                            ? "rounded-[1.35rem] rounded-bl-md bg-gradient-to-b from-violet-50/95 to-indigo-50/90 text-ink ring-1 ring-violet-200/45"
                            : "rounded-[1.35rem] rounded-bl-md bg-white/95 text-ink ring-1 ring-ink/10"
                      }`}
                    >
                      <p
                        className={`text-[11px] font-black ${
                          mine ? "text-surface/70" : isBot ? "text-violet-800/90" : "text-muted"
                        }`}
                      >
                        {isBot
                          ? message.displayName
                            ? `${labels.botBadge} · ${message.displayName}`
                            : labels.botBadge
                          : message.displayName || labels.userLabel}
                        <span className="ml-1.5 font-bold opacity-80">
                          {labels.lobbyChatTimeLabel.replace("{time}", timeStr)}
                        </span>
                      </p>
                      <p
                        className={`mt-1.5 whitespace-pre-wrap break-words text-sm font-semibold leading-relaxed ${
                          mine ? "text-surface" : "text-ink"
                        }`}
                      >
                        {message.message}
                      </p>
                    </article>
                  </div>
                );
              })
            )}
          </div>
          <form
            className="border-t border-ink/10 p-3"
            onSubmit={(event) => {
              event.preventDefault();
              sendLobbyMessage();
            }}
          >
            <div className="flex gap-2">
              <Input
                className="min-h-10 min-w-0 flex-1 bg-paper shadow-none"
                maxLength={500}
                onChange={(event) => setChatText(event.target.value)}
                placeholder={labels.lobbyMessagePlaceholder}
                value={chatText}
              />
              <Button
                className="min-h-10 px-3"
                disabled={!userId || !socketConnected || chatText.trim().length === 0}
                type="submit"
              >
                {labels.lobbySend}
              </Button>
            </div>
          </form>
        </section>

        <LobbyRosterColumn {...rosterColumnProps} variant="desktop" />
      </div>

      <details className="mt-4 rounded-2xl border border-ink/10 bg-surface shadow-sm open:pb-1">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-bold tracking-tight text-ink outline-none marker:content-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
          {labels.leaderboardFoldTitle}
        </summary>
        <div className="border-t border-ink/10 px-3 pb-3 pt-2">
          <BattleLobbyLeaderboardPanel
            className="mt-0 border-0 bg-transparent p-0 shadow-none"
            hideIntro
            labels={labels}
          />
        </div>
      </details>
    </main>
  );
}

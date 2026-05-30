import type { BattleBotAnimationState } from "@nihongo-bjt/shared";

import type { BattleBotRiveMetadata } from "../../../_components/battle-bot-avatar";

export type BattlePageLabels = {
  answerCorrect: string;
  answerWaiting: string;
  answerWrong: string;
  arenaTitle: string;
  backToLobby: string;
  battleDeck: string;
  battleRhythm: string;
  botBadge: string;
  botConfidence: string;
  botMood: string;
  botsJ1: string;
  botsJ2: string;
  botsJ3: string;
  botsJ4: string;
  chatRateLimited: string;
  chooseArena: string;
  combo: string;
  countdownCancel: string;
  countdownConnected: string;
  countdownGo: string;
  countdownPreparing: string;
  countdownReconnecting: string;
  countdownStarting: string;
  countdownStartingIn: string;
  connecting: string;
  difficultyEasy: string;
  difficultyHard: string;
  difficultyMedium: string;
  enterActiveMatch: string;
  error: string;
  eyebrow: string;
  finalScore: string;
  focusPanel: string;
  lobbyChallenge: string;
  lobbyChallengeReceived: string;
  lobbyChallengeSent: string;
  lobbyConnectionOffline: string;
  lobbyConnectionOnline: string;
  lobbyEmpty: string;
  lobbyMessagePlaceholder: string;
  lobbyOnline: string;
  lobbyOpenRoster: string;
  lobbyCloseRoster: string;
  lobbyRoster: string;
  lobbySend: string;
  lobbySubtitle: string;
  lobbyTitle: string;
  matchActiveBanner: string;
  matchScreenEyebrow: string;
  matchScreenTitle: string;
  matchDocumentTitle: string;
  nextRound: string;
  noQuestions: string;
  notStartedHint: string;
  opponent: string;
  pickBot: string;
  popoverAccuracy: string;
  popoverSpeed: string;
  popoverVocab: string;
  progressBarLabel: string;
  pvpAbandoned: string;
  pvpComfortLoseBody: string;
  pvpComfortLoseTitle: string;
  pvpLossBySelfQuitBody: string;
  pvpLossBySelfQuitTitle: string;
  pvpAccept: string;
  pvpChallengeBody: string;
  pvpChallengeDeclined: string;
  pvpChallengeExpired: string;
  pvpChallengeTitle: string;
  pvpDecline: string;
  pvpMatchFound: string;
  pvpMonogram: string;
  pvpOpponentAnswered: string;
  pvpScoreLine: string;
  pvpSessionBadge: string;
  pvpVictorySubtitle: string;
  pvpVictoryTitle: string;
  pvpWaiting: string;
  pvpWinByOpponentQuitBody: string;
  pvpWinByOpponentQuitTitle: string;
  questionProgress: string;
  rematch: string;
  roundSkill: string;
  scoreLine: string;
  shareError?: string;
  shareOptInRequired?: string;
  sharePrivacyNotice?: string;
  shareResult?: string;
  shareResultPrivacy?: string;
  shareSuccess?: string;
  start: string;
  startBotDisabledHint: string;
  statsMilestoneFirstWin: string;
  statsMilestoneBattler10: string;
  statsMilestonePvpContender: string;
  statsMilestoneSteady60: string;
  statsMilestonesHeading: string;
  statsAbbrevWin: string;
  statsAbbrevLoss: string;
  statsAbbrevDraw: string;
  statsWinRateShortLabel: string;
  statsWinRateLabel: string;
  statsBotTab: string;
  statsCompletedLabel: string;
  statsDrawsLabel: string;
  statsHeading: string;
  statsLoadError: string;
  statsLossesLabel: string;
  statsPvpTab: string;
  statsRefreshHint: string;
  statsSubtitle: string;
  statsWinsLabel: string;
  leaderboardAvgScore: string;
  leaderboardEmpty: string;
  leaderboardHeading: string;
  leaderboardLoadError: string;
  leaderboardLossesShort: string;
  leaderboardMatchesShort: string;
  leaderboardRank: string;
  leaderboardSubtitle: string;
  leaderboardPlayer: string;
  leaderboardWinRate: string;
  leaderboardWinsShort: string;
  leaderboardWindow30d: string;
  leaderboardWindow90d: string;
  leaderboardWindowAll: string;
  leaderboardYou: string;
  leaderboardFoldTitle: string;
  leaderboardYourRank: string;
  popoverStatsCouldNotLoad: string;
  popoverStatsHeading: string;
  popoverStatsLoading: string;
  popoverStatsMatchesLine: string;
  popoverStatsWLDR: string;
  popoverStatsWinRateLine: string;
  botPopoverBattleRecordHint: string;
  lobbyChatTimeLabel: string;
  subtitle: string;
  systemReady: string;
  timeBarLabel: string;
  timerLabel: string;
  title: string;
  userId: string;
  userLabel: string;
  userPopoverMember: string;
  vocabAdvanced: string;
  vocabBasic: string;
  vocabIntermediate: string;
  vs: string;
  botPersonas: {
    j1: string;
    j2: string;
    j3: string;
    j4: string;
  };
  botStatus: Record<BattleBotAnimationState, string>;
  finishedDraw: string;
  finishedLose: string;
  finishedLoseCta: string;
  finishedWin: string;
};

export type BattleBotStageProfile = {
  accuracyPct?: number;
  avatarFallback: string;
  difficulty?: string;
  key: string;
  label: string;
  maxDelayMs?: number;
  minDelayMs?: number;
  persona: string | null;
  rive: BattleBotRiveMetadata;
  styleToken: "calm" | "focused" | "sharp";
  vocabularyLevel?: string;
};

export const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
export const socketUrl = apiBase;

export const fallbackBotChoices: BattleBotStageProfile[] = [
  {
    accuracyPct: 76,
    avatarFallback: "J1",
    difficulty: "hard",
    key: "bot_j1",
    label: "battle.bots.j1",
    maxDelayMs: 1700,
    minDelayMs: 260,
    persona: "battle.botPersonas.j1",
    rive: {
      artboard: null,
      src: "/assets/battle/bots/23764-44433-character-customization-ui.riv",
      stateMachine: null
    },
    styleToken: "sharp",
    vocabularyLevel: "bjt_advanced"
  },
  {
    accuracyPct: 40,
    avatarFallback: "J2",
    difficulty: "easy",
    key: "bot_j2",
    label: "battle.bots.j2",
    maxDelayMs: 2400,
    minDelayMs: 450,
    persona: "battle.botPersonas.j2",
    rive: {
      artboard: null,
      src: "/assets/battle/bots/18912-35694-lil-guy.riv",
      stateMachine: null
    },
    styleToken: "calm",
    vocabularyLevel: "bjt_basic"
  },
  {
    accuracyPct: 55,
    avatarFallback: "J3",
    difficulty: "medium",
    key: "bot_j3",
    label: "battle.bots.j3",
    maxDelayMs: 2000,
    minDelayMs: 350,
    persona: "battle.botPersonas.j3",
    rive: {
      artboard: null,
      src: "/assets/battle/bots/24876-46460-interactive-bunny-character.riv",
      stateMachine: null
    },
    styleToken: "focused",
    vocabularyLevel: "bjt_intermediate"
  },
  {
    accuracyPct: 68,
    avatarFallback: "J4",
    difficulty: "hard",
    key: "bot_j4",
    label: "battle.bots.j4",
    maxDelayMs: 1800,
    minDelayMs: 280,
    persona: "battle.botPersonas.j4",
    rive: {
      artboard: null,
      src: "/assets/battle/bots/20538-38646-cheeky-chops.riv",
      stateMachine: null
    },
    styleToken: "sharp",
    vocabularyLevel: "bjt_advanced"
  }
];

export type InteractionType = "multiple_choice" | "matching" | "audio_only" | "boss_hp" | "passage";

export type GameType =
  | "speed_duel"
  | "kanji_vocab_duel"
  | "listening_challenge"
  | "business_roleplay"
  | "boss_rush"
  | "mock_exam_sprint"
  | "team_room"
  | "tournament"
  | "custom";

export type QuestionEvent = {
  gameType?: GameType | string;
  interactionType?: InteractionType | string;
  question: {
    audioScript?: string | null;
    audioUrl?: string | null;
    options: Array<{ optionKey: string; text: string }>;
    prompt: string;
    skillTag: string;
  };
  roomCode: string;
  roundIndex: number;
  timeLimitSec: number;
  totalRounds: number;
};

export type FinishedEvent = {
  outcome: "draw" | "lose" | "win";
  remediation?: { ctaPath: string; kind: string } | null;
  sessionId?: string;
  /** PvP: set when match ends by forfeit / disconnect */
  pvpEndReason?: "opponent_quit" | "self_quit";
};

export type AnswerResultEvent = {
  botCorrect?: boolean;
  correctOptionKey: string;
  opponentCorrect?: boolean;
  roundIndex: number;
  userCorrect: boolean;
};

export type PvpMatchEvent = {
  maxRounds: number;
  mode: "pvp";
  opponentDisplayName: string | null;
  roomCode: string;
  sessionId: string;
  userDisplayName: string | null;
};

/** Server sends this after reconnect when a PvP room is still active */
export type PvpResyncEvent = {
  maxRounds: number;
  opponentDisplayName: string;
  opponentScore: number;
  question: QuestionEvent | null;
  roomCode: string;
  roomState: "countdown" | "finished" | "question" | "resolving";
  sessionId: string;
  settlingRound: boolean;
  showCountdownOverlay: boolean;
  timeLeftSec: number | null;
  userScore: number;
};

export type BotStateEvent = {
  botKey: string;
  persona: string | null;
  rive: BattleBotRiveMetadata;
  state: BattleBotAnimationState;
  styleToken: "calm" | "focused" | "sharp";
};

export type LobbyMessage = {
  createdAt: string;
  displayName: string | null;
  id: string;
  kind: string;
  message: string;
  roomKey: string;
  userId: string;
};

export type PresenceUser = {
  displayName: string | null;
  joinedAt: string;
  userId: string;
};

export type UserChallenge = {
  challengeId: string;
  createdAt: string;
  fromDisplayName: string | null;
  fromUserId: string;
  targetUserId: string;
};

export function botName(labels: BattlePageLabels, i18nKey: string) {
  if (i18nKey === "battle.bots.j1") return labels.botsJ1;
  if (i18nKey === "battle.bots.j2") return labels.botsJ2;
  if (i18nKey === "battle.bots.j3") return labels.botsJ3;
  if (i18nKey === "battle.bots.j4") return labels.botsJ4;
  return i18nKey;
}

export function personaLabel(labels: BattlePageLabels, value?: string | null) {
  if (value === "battle.botPersonas.j1") return labels.botPersonas.j1;
  if (value === "battle.botPersonas.j2") return labels.botPersonas.j2;
  if (value === "battle.botPersonas.j3") return labels.botPersonas.j3;
  if (value === "battle.botPersonas.j4") return labels.botPersonas.j4;
  return value ?? "";
}

export function localizeDifficulty(labels: BattlePageLabels, raw?: string | null) {
  if (raw === "easy") return labels.difficultyEasy;
  if (raw === "medium") return labels.difficultyMedium;
  if (raw === "hard") return labels.difficultyHard;
  return raw ?? null;
}

export function localizeVocab(labels: BattlePageLabels, raw?: string | null) {
  if (raw === "bjt_basic") return labels.vocabBasic;
  if (raw === "bjt_intermediate") return labels.vocabIntermediate;
  if (raw === "bjt_advanced") return labels.vocabAdvanced;
  return raw ?? null;
}

export function styleFor(token: BattleBotStageProfile["styleToken"]) {
  if (token === "calm") {
    return {
      accent: "bg-sky-500",
      border: "border-sky-200",
      panel: "from-sky-50 via-white to-emerald-50",
      text: "text-sky-700"
    };
  }
  if (token === "sharp") {
    return {
      accent: "bg-rose-500",
      border: "border-rose-200",
      panel: "from-rose-50 via-white to-amber-50",
      text: "text-rose-700"
    };
  }
  return {
    accent: "bg-accent",
    border: "border-accent/20",
    panel: "from-blue-50 via-white to-emerald-50",
    text: "text-accent"
  };
}

export function metricWidth(value: number | null) {
  if (value === null) return "0%";
  return `${Math.max(0, Math.min(100, value))}%`;
}

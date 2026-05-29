"use client";

import type { BattleBotAnimationState } from "@nihongo-bjt/shared";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { io, type Socket } from "socket.io-client";

import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";
import { learnerApiFetch } from "../../../../lib/learner-api";
import { recordStudyProgress } from "../../../_hooks/use-study-progress";
import {
  apiBase,
  botName,
  type AnswerResultEvent,
  type BattleBotStageProfile,
  type BattlePageLabels,
  type BotStateEvent,
  type FinishedEvent,
  type LobbyMessage,
  type PresenceUser,
  type PvpMatchEvent,
  type PvpResyncEvent,
  type QuestionEvent,
  type UserChallenge,
  fallbackBotChoices,
  socketUrl
} from "./battle-types";

export type PvpEndReason = NonNullable<FinishedEvent["pvpEndReason"]>;

const PENDING_KEY = "bjt_battle_pending";

type BattleRuntimeContextValue = {
  labels: BattlePageLabels;
  locale: string;
  userId: string | null;
  accessToken: string | null;
  learnerDisplayName: string;
  socketConnected: boolean;
  answerPending: boolean;
  answerResult: AnswerResultEvent | null;
  battleMode: "bot" | "pvp";
  botChoices: BattleBotStageProfile[];
  botChoicesLoading: boolean;
  botKey: string;
  botProfile: BattleBotStageProfile | null;
  botState: BattleBotAnimationState;
  botComment: string | null;
  combo: number;
  countdown: number | null;
  error: string | null;
  lobbyMessages: LobbyMessage[];
  lobbyNotice: string | null;
  opponentName: string | null;
  opponentScore: number;
  outcome: "draw" | "lose" | "win" | null;
  presence: PresenceUser[];
  remediation: { ctaPath: string; kind: string } | null;
  round: QuestionEvent | null;
  selectedOptionKey: string | null;
  shareLoading: boolean;
  shareUrl: string | null;
  showCountdownOverlay: boolean;
  status: string | null;
  timeLeft: number | null;
  userScore: number;
  pvpChallenge: UserChallenge | null;
  pvpOpponentAnswered: boolean;
  chatText: string;
  setChatText: (v: string) => void;
  setBotKey: (k: string) => void;
  setBotProfile: (b: BattleBotStageProfile | null) => void;
  setBotState: (s: BattleBotAnimationState) => void;
  setLobbyNotice: (v: string | null) => void;
  selectedBot: BattleBotStageProfile;
  displayedBot: BattleBotStageProfile;
  isMatchUiActive: boolean;
  pvpEndReason: PvpEndReason | null;
  selectedConfigId: string | null;
  activeGameType: string | null;
  setSelectedConfigId: (id: string | null) => void;
  setActiveGameType: (gt: string | null) => void;
  setPvpChallenge: (c: UserChallenge | null) => void;
  connectAndStart: () => void;
  submitAnswer: (optionKey: string) => void;
  acceptPvpChallenge: () => void;
  declinePvpChallenge: () => void;
  handleShareResult: () => Promise<void>;
  sendLobbyMessage: () => void;
  challengeUser: (targetUserId: string) => void;
  goToLobby: () => void;
  pickBot: (bot: BattleBotStageProfile) => void;
  cancelCountdown: () => void;
  completeCountdown: () => void;
};

const BattleRuntimeContext = createContext<BattleRuntimeContextValue | null>(null);

export function useBattleRuntime() {
  const ctx = useContext(BattleRuntimeContext);
  if (!ctx) {
    throw new Error("useBattleRuntime must be used under BattleRuntimeProvider");
  }
  return ctx;
}

export function readBattlePending() {
  try {
    return sessionStorage.getItem(PENDING_KEY) === "1";
  } catch {
    return false;
  }
}

function markPending() {
  try {
    sessionStorage.setItem(PENDING_KEY, "1");
  } catch {
    /* ignore */
  }
}

function clearPending() {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

export function BattleRuntimeProvider({
  children,
  labels,
  locale
}: {
  children: ReactNode;
  labels: BattlePageLabels;
  locale: string;
}) {
  const router = useRouter();
  const socketRef = useRef<Socket | null>(null);
  const { accessToken, displayName, email, userId } = useKeycloakAuth();
  const [answerPending, setAnswerPending] = useState(false);
  const [answerResult, setAnswerResult] = useState<AnswerResultEvent | null>(null);
  const [botChoices, setBotChoices] = useState<BattleBotStageProfile[]>(fallbackBotChoices);
  const [botChoicesLoading, setBotChoicesLoading] = useState(false);
  const [botKey, setBotKey] = useState("bot_j3");
  const [botProfile, setBotProfile] = useState<BattleBotStageProfile | null>(null);
  const [botState, setBotState] = useState<BattleBotAnimationState>("idle");
  const [chatText, setChatText] = useState("");
  const [combo, setCombo] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lobbyMessages, setLobbyMessages] = useState<LobbyMessage[]>([]);
  const [lobbyNotice, setLobbyNotice] = useState<string | null>(null);
  const [opponentName, setOpponentName] = useState<string | null>(null);
  const [opponentScore, setOpponentScore] = useState(0);
  const [outcome, setOutcome] = useState<"draw" | "lose" | "win" | null>(null);
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [remediation, setRemediation] = useState<{ ctaPath: string; kind: string } | null>(null);
  const [round, setQuestion] = useState<QuestionEvent | null>(null);
  const [selectedOptionKey, setSelectedOptionKey] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [showCountdownOverlay, setShowCountdownOverlay] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [userScore, setUserScore] = useState(0);
  const [battleMode, setBattleMode] = useState<"bot" | "pvp">("bot");
  const [pvpRoomCode, setPvpRoomCode] = useState<string | null>(null);
  const [pvpChallenge, setPvpChallenge] = useState<UserChallenge | null>(null);
  const [pvpOpponentAnswered, setPvpOpponentAnswered] = useState(false);
  const [pvpEndReason, setPvpEndReason] = useState<PvpEndReason | null>(null);
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [activeGameType, setActiveGameType] = useState<string | null>(null);
  const [botComment, setBotComment] = useState<string | null>(null);
  const botCommentTimer = useRef<NodeJS.Timeout | null>(null);

  const pathname = usePathname();
  const learnerDisplayName = displayName || email || labels.userLabel;
  const selectedBot = botChoices.find((bot) => bot.key === botKey) ?? fallbackBotChoices[2]!;
  const displayedBot = botProfile ?? selectedBot;

  const isMatchUiActive =
    round !== null ||
    outcome !== null ||
    showCountdownOverlay ||
    status === labels.connecting;

  const navigateToMatch = useCallback(() => {
    queueMicrotask(() => {
      router.push(`/${locale}/battle/match`);
    });
  }, [locale, router]);

  const navigateToLobby = useCallback(() => {
    queueMicrotask(() => {
      router.push(`/${locale}/battle`);
    });
  }, [locale, router]);

  const clearSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  useEffect(() => clearSocket, [clearSocket]);

  /** Leaving match via in-app link leaves outcome in memory; clear on lobby so roster is not "still in match" */
  useEffect(() => {
    const parts = pathname?.split("/").filter(Boolean) ?? [];
    if (parts.length !== 2 || parts[1] !== "battle") return;

    const activePvpSession =
      battleMode === "pvp" &&
      (Boolean(pvpRoomCode) ||
        round !== null ||
        showCountdownOverlay ||
        status === labels.connecting);

    if (activePvpSession) return;

    if (outcome === null && battleMode !== "pvp") return;

    setOutcome(null);
    setPvpEndReason(null);
    setRemediation(null);
    setAnswerResult(null);
    setQuestion(null);
    setShareUrl(null);
    setShowCountdownOverlay(false);
    setCountdown(null);
    setTimeLeft(null);
    setBattleMode("bot");
    setOpponentName(null);
    setUserScore(0);
    setOpponentScore(0);
    setBotState("idle");
    setStatus(null);
    setPvpOpponentAnswered(false);
    setPvpRoomCode(null);
    clearPending();
  }, [
    pathname,
    outcome,
    battleMode,
    pvpRoomCode,
    round,
    showCountdownOverlay,
    status,
    labels.connecting
  ]);

  const attachSocketListeners = useCallback(
    (s: Socket, uid: string) => {
      s.on("connect", () => {
        setSocketConnected(true);
        s.emit("battle:lobby_join", { displayName: learnerDisplayName, userId: uid });
      });
      s.on("disconnect", () => {
        setSocketConnected(false);
      });
      s.on("battle:lobby_presence", (p: { users: PresenceUser[] }) => {
        setPresence(p.users);
      });
      s.on("battle:lobby_message", (message: LobbyMessage) => {
        setLobbyMessages((current) => {
          if (current.some((item) => item.id === message.id)) return current;
          return [...current, message].slice(-80);
        });
      });
      s.on("battle:user_challenge_sent", () => {
        setLobbyNotice(labels.lobbyChallengeSent);
      });
      s.on("battle:user_challenge_received", (challenge: UserChallenge) => {
        setPvpChallenge(challenge);
        setLobbyNotice(
          labels.lobbyChallengeReceived.replace(
            "{name}",
            challenge.fromDisplayName || labels.userLabel
          )
        );
      });
      s.on("battle:challenge_expired", () => {
        setLobbyNotice(labels.pvpChallengeExpired);
        setPvpChallenge(null);
      });
      s.on("battle:challenge_declined", () => {
        setLobbyNotice(labels.pvpChallengeDeclined);
        setPvpChallenge(null);
      });
      s.on("battle:pvp_match_found", (p: PvpMatchEvent) => {
        clearPending();
        setBattleMode("pvp");
        setPvpRoomCode(p.roomCode);
        setPvpChallenge(null);
        setBotProfile(null);
        setOpponentName(p.opponentDisplayName ?? labels.opponent);
        setShowCountdownOverlay(true);
        setStatus(null);
        setBotState("matched");
        setLobbyNotice(
          labels.pvpMatchFound.replace("{name}", p.opponentDisplayName ?? labels.opponent)
        );
        navigateToMatch();
      });
      s.on("battle:pvp_resync", (p: PvpResyncEvent) => {
        clearPending();
        setBattleMode("pvp");
        setPvpRoomCode(p.roomCode);
        setPvpChallenge(null);
        setBotProfile(null);
        setOpponentName(p.opponentDisplayName || labels.opponent);
        setUserScore(p.userScore);
        setOpponentScore(p.opponentScore);
        setOutcome(null);
        setError(null);
        setAnswerResult(null);
        setSelectedOptionKey(null);
        setShareUrl(null);
        setRemediation(null);
        setCombo(0);
        setPvpOpponentAnswered(false);
        setStatus(null);
        if (p.question) {
          setQuestion(p.question);
          setTimeLeft(p.timeLeftSec ?? p.question.timeLimitSec);
          setShowCountdownOverlay(false);
          setCountdown(null);
          setAnswerPending(Boolean(p.settlingRound));
          setBotState("thinking");
        } else {
          setQuestion(null);
          setTimeLeft(null);
          setAnswerPending(false);
          setShowCountdownOverlay(p.showCountdownOverlay);
          setCountdown(null);
          setBotState("matched");
        }
        setLobbyNotice(null);
        navigateToMatch();
      });
      s.on("battle:pvp_opponent_answered", () => {
        setPvpOpponentAnswered(true);
      });
      s.on("battle:pvp_abandoned", () => {
        clearPending();
        setLobbyNotice(labels.pvpAbandoned);
        setQuestion(null);
        setOutcome(null);
        setPvpEndReason(null);
        setStatus(null);
        setBattleMode("bot");
        setPvpRoomCode(null);
        setShowCountdownOverlay(false);
        navigateToLobby();
      });
      s.on("battle:lobby_error", (p: { code: string } | undefined) => {
        clearPending();
        setStatus(null);
        setPvpChallenge(null);
        setLobbyNotice(
          p?.code === "rate_limited"
            ? labels.chatRateLimited
            : p?.code === "challenge_expired"
              ? labels.pvpChallengeExpired
              : `${labels.error} (${p?.code ?? "lobby"})`
        );
      });
      s.on("battle:error", (p: { code: string } | undefined) => {
        clearPending();
        const code = p?.code ?? "unknown";
        setError(code === "no_questions" ? labels.noQuestions : `${labels.error} (${code})`);
        setStatus(null);
      });
      s.on("battle:match_found", (p: { bot: BattleBotStageProfile; gameType?: string }) => {
        clearPending();
        setBattleMode("bot");
        setPvpRoomCode(null);
        setBotProfile(p.bot);
        setOpponentName(botName(labels, p.bot.label));
        setStatus(null);
        setBotState("matched");
        setShowCountdownOverlay(true);
        if (p.gameType) setActiveGameType(p.gameType);
        navigateToMatch();
      });
      s.on("battle:bot_state", (p: BotStateEvent) => {
        setBotProfile((current) =>
          current?.key === p.botKey
            ? { ...current, persona: p.persona, rive: p.rive, styleToken: p.styleToken }
            : current
        );
        setBotState(p.state);
      });
      s.on("battle:countdown", (p: { value: number }) => {
        setCountdown(p.value);
        setBotState("countdown");
      });
      s.on("battle:question", (p: QuestionEvent) => {
        setCountdown(null);
        setShowCountdownOverlay(false);
        setQuestion(p);
        setTimeLeft(p.timeLimitSec);
        setAnswerPending(false);
        setSelectedOptionKey(null);
        setAnswerResult(null);
        setPvpOpponentAnswered(false);
        setBotState("thinking");
        setBotComment(null);
        if (p.gameType) setActiveGameType(p.gameType as string);
      });
      s.on("battle:answer_result", (p: AnswerResultEvent) => {
        setAnswerResult(p);
        setAnswerPending(false);
        setCombo((current) => (p.userCorrect ? current + 1 : 0));
        const oppCorrect = p.botCorrect ?? p.opponentCorrect ?? false;
        setBotState(oppCorrect ? "correct" : "wrong");
      });
      s.on("battle:score_update", (p: { opponentScore: number; userScore: number }) => {
        setUserScore(p.userScore);
        setOpponentScore(p.opponentScore);
      });
      s.on("battle:bot_comment", (p: { message: string }) => {
        setBotComment(p.message);
        if (botCommentTimer.current) clearTimeout(botCommentTimer.current);
        botCommentTimer.current = setTimeout(() => setBotComment(null), 4000);
      });
      s.on("battle:finished", (p: FinishedEvent) => {
        setQuestion(null);
        setOutcome(p.outcome);
        recordStudyProgress("battle_bot");
        setPvpEndReason(p.pvpEndReason ?? null);
        setRemediation(p.remediation ?? null);
        setStatus(null);
        setCountdown(null);
        setTimeLeft(null);
        setAnswerPending(false);
        setSelectedOptionKey(null);
        setPvpRoomCode(null);
        if (p.pvpEndReason) {
          setBotState("idle");
        } else {
          setBotState(p.outcome === "win" ? "lose" : p.outcome === "lose" ? "win" : "draw");
        }
      });
    },
    [labels, learnerDisplayName, navigateToLobby, navigateToMatch]
  );

  const ensureSocket = useCallback(() => {
    const uid = userId;
    if (!uid) return null;
    if (socketRef.current) return socketRef.current;
    const s = io(`${socketUrl}/battle`, {
      path: "/socket.io",
      reconnection: true,
      reconnectionAttempts: 3,
      transports: ["websocket", "polling"]
    });
    socketRef.current = s;
    attachSocketListeners(s, uid);
    return s;
  }, [attachSocketListeners, userId]);

  useEffect(() => {
    ensureSocket();
  }, [ensureSocket]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!accessToken) {
        setBotChoices(fallbackBotChoices);
        return;
      }
      setBotChoicesLoading(true);
      try {
        const response = await fetch(`${apiBase}/api/battle/bots`, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (!response.ok) {
          if (!cancelled) setBotChoices(fallbackBotChoices);
          return;
        }
        const data = (await response.json()) as Array<
          Omit<BattleBotStageProfile, "key"> & { botKey: string }
        >;
        if (!cancelled && data.length > 0) {
          const mapped = data.map((bot) => ({ ...bot, key: bot.botKey }));
          setBotChoices(mapped);
          if (!mapped.some((bot) => bot.key === botKey)) {
            setBotKey(mapped[0]?.key ?? "bot_j3");
          }
        }
      } catch {
        if (!cancelled) setBotChoices(fallbackBotChoices);
      } finally {
        if (!cancelled) setBotChoicesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, botKey]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!accessToken || !userId) {
        setLobbyMessages([]);
        return;
      }
      try {
        const params = new URLSearchParams({ limit: "40", roomKey: "global", userId });
        const response = await fetch(`${apiBase}/api/battle/chat/recent?${params.toString()}`, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (!response.ok) return;
        const data = (await response.json()) as LobbyMessage[];
        if (!cancelled) setLobbyMessages(data);
      } catch {
        if (!cancelled) setLobbyMessages([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, userId]);

  useEffect(() => {
    if (!round || answerResult) return;
    setTimeLeft(round.timeLimitSec);
    const interval = window.setInterval(() => {
      setTimeLeft((current) => (current === null ? current : Math.max(0, current - 1)));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [answerResult, round]);

  const connectAndStart = useCallback(() => {
    const uid = userId;
    if (!uid) return;
    markPending();
    setAnswerPending(false);
    setAnswerResult(null);
    setBattleMode("bot");
    setBotProfile(selectedBot);
    setBotState("idle");
    setCombo(0);
    setCountdown(null);
    setError(null);
    setOpponentScore(0);
    setOutcome(null);
    setPvpRoomCode(null);
    setQuestion(null);
    setRemediation(null);
    setSelectedOptionKey(null);
    setShareUrl(null);
    setStatus(labels.connecting);
    setTimeLeft(null);
    setUserScore(0);
    const s = ensureSocket();
    if (!s) {
      clearPending();
      return;
    }
    if (s.connected) {
      s.emit("battle:challenge_bot", { botKey, configId: selectedConfigId ?? undefined, userId: uid });
      return;
    }
    s.once("connect", () => {
      s.emit("battle:challenge_bot", { botKey, configId: selectedConfigId ?? undefined, userId: uid });
    });
  }, [botKey, ensureSocket, labels.connecting, selectedBot, selectedConfigId, userId]);

  const submitAnswer = useCallback(
    (optionKey: string) => {
      const s = socketRef.current;
      const q = round;
      const uid = userId;
      if (!s || !q || !uid || answerPending || answerResult) return;
      setSelectedOptionKey(optionKey);
      setAnswerPending(true);
      const event = battleMode === "pvp" ? "battle:pvp_answer" : "battle:answer";
      s.emit(event, {
        idempotencyKey: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${q.roundIndex}`,
        optionKey,
        roomCode: q.roomCode,
        roundIndex: q.roundIndex,
        userId: uid
      });
    },
    [answerPending, answerResult, battleMode, round, userId]
  );

  const acceptPvpChallenge = useCallback(() => {
    const s = ensureSocket();
    const uid = userId;
    const challenge = pvpChallenge;
    if (!s || !uid || !challenge) return;
    markPending();
    s.emit("battle:accept_challenge", {
      challengeId: challenge.challengeId,
      fromUserId: challenge.fromUserId,
      userId: uid
    });
    setPvpChallenge(null);
    setStatus(labels.connecting);
    setError(null);
    setOutcome(null);
    setQuestion(null);
    setBotProfile(null);
    setUserScore(0);
    setOpponentScore(0);
    setCombo(0);
    setRemediation(null);
    setShareUrl(null);
    // Timeout: if server doesn't respond within 8s, reset to idle
    const timeout = window.setTimeout(() => {
      setStatus((prev) => {
        if (prev === labels.connecting) {
          clearPending();
          setLobbyNotice(labels.pvpChallengeExpired);
          return null;
        }
        return prev;
      });
    }, 8000);
    // Clear timeout if match found (socket event will update status)
    const cleanup = () => window.clearTimeout(timeout);
    socketRef.current?.once("battle:pvp_match_found", cleanup);
    socketRef.current?.once("battle:lobby_error", cleanup);
    socketRef.current?.once("battle:error", cleanup);
  }, [ensureSocket, labels.connecting, labels.pvpChallengeExpired, pvpChallenge, userId]);

  const declinePvpChallenge = useCallback(() => {
    const s = ensureSocket();
    const uid = userId;
    const challenge = pvpChallenge;
    if (!s || !uid || !challenge) return;
    s.emit("battle:decline_challenge", {
      challengeId: challenge.challengeId,
      fromUserId: challenge.fromUserId,
      userId: uid
    });
    setPvpChallenge(null);
  }, [ensureSocket, pvpChallenge, userId]);

  const handleShareResult = useCallback(async () => {
    const uid = userId;
    if (!uid || !outcome) return;
    setShareLoading(true);
    setError(null);
    try {
      const body = {
        kind: "battle" as const,
        payload: {
          ...(opponentName && opponentName.trim().length > 0
            ? { opponentName: opponentName.trim() }
            : {}),
          result: outcome
        },
        userId: uid
      };
      const response = await learnerApiFetch("/api/learner/share", {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      if (!response.ok) {
        let message = labels.shareError ?? labels.error;
        try {
          const payload = (await response.json()) as {
            code?: string;
            message?: unknown;
          };
          const nested =
            payload?.message && typeof payload.message === "object" && payload.message !== null
              ? (payload.message as { code?: string })
              : null;
          const code = payload?.code ?? nested?.code;
          if (
            code === "share_opt_in_required" ||
            (typeof payload?.message === "string" && payload.message.toLowerCase().includes("opt"))
          ) {
            message = labels.shareOptInRequired ?? message;
          }
        } catch {
          /* ignore */
        }
        setError(message);
        return;
      }
      const data = (await response.json()) as { imagePath: string; shareUrl: string };
      if (typeof navigator.clipboard?.writeText === "function") {
        void navigator.clipboard.writeText(data.shareUrl);
      }
      setShareUrl(data.shareUrl);
    } catch {
      setError(labels.shareError ?? labels.error);
    } finally {
      setShareLoading(false);
    }
  }, [labels, opponentName, outcome, userId]);

  const sendLobbyMessage = useCallback(() => {
    const s = ensureSocket();
    const uid = userId;
    const message = chatText.trim();
    if (!s || !uid || !message) return;
    s.emit("battle:lobby_message", {
      clientMessageId: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`,
      displayName: learnerDisplayName,
      message,
      roomKey: "global",
      userId: uid
    });
    setChatText("");
  }, [chatText, ensureSocket, learnerDisplayName, userId]);

  const challengeUser = useCallback(
    (targetUserId: string) => {
      const s = ensureSocket();
      const uid = userId;
      if (!s || !uid || targetUserId === uid) return;
      s.emit("battle:challenge_user", {
        fromDisplayName: learnerDisplayName,
        fromUserId: uid,
        targetUserId
      });
    },
    [ensureSocket, learnerDisplayName, userId]
  );

  const goToLobby = useCallback(() => {
    const s = socketRef.current;
    const uid = userId;
    const activePvpRoom = round?.roomCode ?? pvpRoomCode;
    const leavingActivePvp =
      battleMode === "pvp" &&
      Boolean(activePvpRoom) &&
      (round !== null || showCountdownOverlay || status === labels.connecting);
    if (s && uid && leavingActivePvp && activePvpRoom) {
      s.emit("battle:pvp_forfeit", { roomCode: activePvpRoom, userId: uid });
    }
    clearPending();
    setQuestion(null);
    setOutcome(null);
    setPvpEndReason(null);
    setShowCountdownOverlay(false);
    setCountdown(null);
    setStatus(null);
    setError(null);
    setAnswerResult(null);
    setAnswerPending(false);
    setSelectedOptionKey(null);
    setShareUrl(null);
    setRemediation(null);
    setPvpOpponentAnswered(false);
    setUserScore(0);
    setOpponentScore(0);
    setCombo(0);
    setBotState("idle");
    setBattleMode("bot");
    setOpponentName(null);
    setBotProfile(null);
    setPvpRoomCode(null);
    navigateToLobby();
  }, [
    battleMode,
    navigateToLobby,
    pvpRoomCode,
    round,
    showCountdownOverlay,
    status,
    labels.connecting,
    userId
  ]);

  const cancelCountdown = useCallback(() => {
    const s = socketRef.current;
    const uid = userId;
    if (battleMode === "pvp" && pvpRoomCode && uid) {
      s?.emit("battle:pvp_forfeit", { roomCode: pvpRoomCode, userId: uid });
      return;
    }
    clearPending();
    setShowCountdownOverlay(false);
    setCountdown(null);
    setStatus(null);
    setBotState("idle");
  }, [battleMode, pvpRoomCode, userId]);

  const pickBot = useCallback(
    (bot: BattleBotStageProfile) => {
      setBotKey(bot.key);
      setBotProfile(bot);
      setBotState("idle");
      setOpponentName(botName(labels, bot.label));
    },
    [labels]
  );

  const completeCountdown = useCallback(() => {
    setShowCountdownOverlay(false);
  }, []);

  const value = useMemo(
    () =>
      ({
        labels,
        locale,
        userId,
        accessToken,
        learnerDisplayName,
        socketConnected,
        answerPending,
        answerResult,
        battleMode,
        botChoices,
        botChoicesLoading,
        botKey,
        botProfile,
        botState,
        botComment,
        combo,
        countdown,
        error,
        lobbyMessages,
        lobbyNotice,
        opponentName,
        opponentScore,
        outcome,
        presence,
        remediation,
        round,
        selectedOptionKey,
        shareLoading,
        shareUrl,
        showCountdownOverlay,
        status,
        timeLeft,
        userScore,
        pvpChallenge,
        pvpOpponentAnswered,
        chatText,
        setChatText,
        setBotKey,
        setBotProfile,
        setBotState,
        setLobbyNotice,
        selectedBot,
        displayedBot,
        isMatchUiActive,
        pvpEndReason,
        selectedConfigId,
        activeGameType,
        setSelectedConfigId,
        setActiveGameType,
        setPvpChallenge,
        connectAndStart,
        submitAnswer,
        acceptPvpChallenge,
        declinePvpChallenge,
        handleShareResult,
        sendLobbyMessage,
        challengeUser,
        goToLobby,
        pickBot,
        cancelCountdown,
        completeCountdown
      }) satisfies BattleRuntimeContextValue,
    [
      labels,
      locale,
      userId,
      accessToken,
      learnerDisplayName,
      socketConnected,
      answerPending,
      answerResult,
      battleMode,
      botChoices,
      botChoicesLoading,
      botKey,
      botProfile,
      botState,
      combo,
      countdown,
      error,
      lobbyMessages,
      lobbyNotice,
      opponentName,
      opponentScore,
      outcome,
      presence,
      remediation,
      round,
      selectedOptionKey,
      shareLoading,
      shareUrl,
      showCountdownOverlay,
      status,
      timeLeft,
      userScore,
      pvpChallenge,
      pvpOpponentAnswered,
      chatText,
      selectedBot,
      displayedBot,
      isMatchUiActive,
      pvpEndReason,
      selectedConfigId,
      activeGameType,
      setSelectedConfigId,
      connectAndStart,
      submitAnswer,
      acceptPvpChallenge,
      declinePvpChallenge,
      handleShareResult,
      sendLobbyMessage,
      challengeUser,
      goToLobby,
      pickBot,
      cancelCountdown,
      completeCountdown
    ]
  );

  return <BattleRuntimeContext.Provider value={value}>{children}</BattleRuntimeContext.Provider>;
}

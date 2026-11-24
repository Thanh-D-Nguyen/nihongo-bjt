// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import viMessages from "../../../../messages/vi.json";
import { fallbackBotChoices, type BattlePageLabels } from "./battle-types";

const runtimeMock = vi.hoisted(() => ({
  connectAndStart: vi.fn(),
  pickBot: vi.fn(),
  setSelectedConfigId: vi.fn(),
  setActiveGameType: vi.fn(),
  challengeUser: vi.fn(),
  acceptPvpChallenge: vi.fn(),
  declinePvpChallenge: vi.fn(),
  sendLobbyMessage: vi.fn(),
  setChatText: vi.fn()
}));

vi.mock("./battle-runtime-provider", () => ({
  useBattleRuntime: () => ({
    battleMode: "bot",
    botChoices: fallbackBotChoices,
    botChoicesLoading: false,
    botKey: "bot_j3",
    botState: "idle",
    challengeUser: runtimeMock.challengeUser,
    chatText: "",
    connectAndStart: runtimeMock.connectAndStart,
    declinePvpChallenge: runtimeMock.declinePvpChallenge,
    acceptPvpChallenge: runtimeMock.acceptPvpChallenge,
    isMatchUiActive: false,
    labels: viMessages.battle as unknown as BattlePageLabels,
    lobbyMessages: [],
    lobbyNotice: null,
    locale: "vi",
    opponentName: null,
    pickBot: runtimeMock.pickBot,
    presence: [],
    pvpChallenge: null,
    sendLobbyMessage: runtimeMock.sendLobbyMessage,
    setChatText: runtimeMock.setChatText,
    socketConnected: true,
    status: null,
    userId: "user-1",
    displayedBot: fallbackBotChoices[2]!,
    setSelectedConfigId: runtimeMock.setSelectedConfigId,
    setActiveGameType: runtimeMock.setActiveGameType
  })
}));
vi.mock("./battle-configs-panel", () => ({
  BattleConfigsPanel: () => <div data-testid="battle-configs-panel">Available Battles</div>
}));
vi.mock("./battle-lobby-leaderboard", () => ({
  BattleLobbyLeaderboardPanel: () => <div data-testid="battle-leaderboard">Leaderboard</div>
}));
vi.mock("../../../_components/battle-bot-avatar", () => ({
  BattleBotAvatar: () => <span data-testid="bot-avatar" />
}));

import { BattleLobbyClient } from "./battle-lobby-client";

describe("BattleLobbyClient quiet 1v1 bot drill", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: true,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }));
    runtimeMock.connectAndStart.mockClear();
    runtimeMock.pickBot.mockClear();
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  });

  it("renders 4 BJT bots, Start button, and Leaderboard without fake reconnect error, BattleConfigsPanel, or global chat", async () => {
    await act(async () => {
      root.render(<BattleLobbyClient />);
    });

    expect(
      host.textContent,
      "battle lobby must not render fake lobbyConnectionOffline box when presence is empty"
    ).not.toContain(viMessages.battle.lobbyConnectionOffline);
    expect(
      host.querySelector('[data-testid="battle-configs-panel"]'),
      "battle lobby must unmount BattleConfigsPanel"
    ).toBeNull();
    expect(
      host.querySelector("form"),
      "battle lobby must unmount global lobby chat composer"
    ).toBeNull();
    expect(host.querySelector('[data-testid="battle-leaderboard"]')).not.toBeNull();

    const botCards = host.querySelectorAll(".battle-bot-card");
    expect(botCards.length, "battle lobby must render all 4 BJT bots").toBe(4);

    const startButton = [...host.querySelectorAll<HTMLButtonElement>("button")].find((btn) =>
      btn.textContent?.includes(viMessages.battle.start)
    );
    expect(startButton, "battle lobby must render the Start bot match button").toBeTruthy();
    expect(startButton!.disabled).toBe(false);
    await act(async () => {
      startButton!.click();
    });
    expect(runtimeMock.connectAndStart).toHaveBeenCalledTimes(1);
  });
});

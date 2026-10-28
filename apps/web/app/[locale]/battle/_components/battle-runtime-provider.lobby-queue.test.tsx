// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BattlePageLabels } from "./battle-types";

type Listener = (payload?: unknown) => void;

class FakeSocket {
  connected = false;
  emitted: Array<[string, unknown]> = [];
  private handlers = new Map<string, Listener[]>();
  on(event: string, listener: Listener) {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), listener]);
  }
  once(event: string, listener: Listener) {
    this.on(event, listener);
  }
  emit(event: string, data?: unknown) {
    this.emitted.push([event, data]);
  }
  removeAllListeners() {
    this.handlers.clear();
  }
  disconnect() {
    this.connected = false;
  }
  fire(event: string, payload?: unknown) {
    for (const listener of this.handlers.get(event) ?? []) listener(payload);
  }
  challenges() {
    return this.emitted.filter(([event]) => event === "battle:challenge_bot");
  }
}

const hoisted = vi.hoisted(() => ({
  sockets: [] as unknown[],
  router: { push: () => undefined, replace: () => undefined, prefetch: () => undefined, back: () => undefined, refresh: () => undefined }
}));

vi.mock("next/navigation", () => ({
  useRouter: () => hoisted.router,
  usePathname: () => "/en/battle",
  useSearchParams: () => new URLSearchParams()
}));
vi.mock("../../../../lib/go-auth-provider", () => {
  const auth = { displayName: "Taro", email: "taro@example.test", isAuthenticated: true, userId: "11111111-1111-4111-8111-111111111111" };
  return { useGoAuth: () => auth };
});
vi.mock("../../../../lib/learner-api", () => ({ learnerApiFetch: vi.fn(() => Promise.reject(new Error("offline"))) }));
vi.mock("../../../_hooks/use-study-progress", () => ({ recordStudyProgress: vi.fn() }));
vi.mock("../../../../lib/go-realtime-client", () => ({
  createGoRealtimeClient: () => {
    const socket = new FakeSocket();
    hoisted.sockets.push(socket);
    return socket;
  }
}));

import { BattleRuntimeProvider, useBattleRuntime } from "./battle-runtime-provider";

const labels = new Proxy({}, { get: (_target, key) => (typeof key === "string" ? key : undefined) }) as unknown as BattlePageLabels;
const PENDING_KEY = "bjt_battle_pending";

describe("BattleRuntimeProvider lobby readiness", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let runtime: ReturnType<typeof useBattleRuntime>;
  let socket: FakeSocket;

  function Probe() {
    runtime = useBattleRuntime();
    return null;
  }

  beforeEach(async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    hoisted.sockets.length = 0;
    sessionStorage.clear();
    container = document.createElement("div");
    root = createRoot(container);
    await act(async () => {
      root.render(
        <BattleRuntimeProvider labels={labels} locale="en">
          <Probe />
        </BattleRuntimeProvider>
      );
    });
    socket = hoisted.sockets[0] as FakeSocket;
    // Transport is up but the server has not acknowledged battle:lobby_join yet.
    await act(async () => {
      socket.connected = true;
      socket.fire("connect");
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function startBotChallenge() {
    await act(async () => runtime.connectAndStart());
    expect(runtime.status).toBe("connecting");
    expect(socket.challenges()).toHaveLength(0);
  }

  it("sends the queued bot challenge once when the lobby is joined", async () => {
    await startBotChallenge();
    await act(async () => socket.fire("battle:lobby_joined"));
    expect(socket.challenges()).toHaveLength(1);
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    expect(socket.challenges()).toHaveLength(1);
    expect(runtime.error).toBeNull();
  });

  it("leaves 'connecting' with a lobby_timeout error when the lobby never joins", async () => {
    await startBotChallenge();
    expect(sessionStorage.getItem(PENDING_KEY)).toBe("1");

    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    expect(runtime.status).toBeNull();
    expect(runtime.error).toContain("lobby_timeout");
    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull();

    // A late lobby join must not resurrect the abandoned challenge.
    await act(async () => socket.fire("battle:lobby_joined"));
    expect(socket.challenges()).toHaveLength(0);
  });

  it("does not send a cancelled challenge when the lobby joins late", async () => {
    await startBotChallenge();
    await act(async () => runtime.cancelCountdown());
    await act(async () => socket.fire("battle:lobby_joined"));
    expect(socket.challenges()).toHaveLength(0);
  });

  it("does not send a challenge after the player went back to the lobby", async () => {
    await startBotChallenge();
    await act(async () => runtime.goToLobby());
    await act(async () => socket.fire("battle:lobby_joined"));
    expect(socket.challenges()).toHaveLength(0);
  });
});

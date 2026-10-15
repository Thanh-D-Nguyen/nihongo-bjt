import { afterEach, describe, expect, it, vi } from "vitest";
import { createGoRealtimeClient } from "./go-realtime-client";

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  static readonly OPEN = 1;
  readyState = 0;
  sent: string[] = [];
  listeners = new Map<string, ((event?: { data: string }) => void)[]>();
  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }
  addEventListener(type: string, listener: (event?: { data: string }) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  send(data: string) { this.sent.push(data); }
  close() { this.readyState = 3; this.dispatch("close"); }
  open() { this.readyState = FakeWebSocket.OPEN; this.dispatch("open"); }
  receive(data: unknown) { this.dispatch("message", { data: JSON.stringify(data) }); }
  dispatch(type: string, event?: { data: string }) { for (const listener of this.listeners.get(type) ?? []) listener(event); }
}

describe("Go realtime client", () => {
  afterEach(() => {
    vi.useRealTimers();
    FakeWebSocket.instances = [];
    vi.unstubAllGlobals();
  });

  it("uses the Go WebSocket endpoint and dispatches the shared JSON event envelope", () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const client = createGoRealtimeClient("http://localhost:4001", "/ws/battle");
    const ws = FakeWebSocket.instances[0]!;
    const connected = vi.fn();
    const joined = vi.fn();
    client.on("connect", connected);
    client.on("battle:lobby_joined", joined);

    expect(String(ws.url)).toBe("ws://localhost:4001/ws/battle");
    ws.open();
    ws.receive({ event: "battle:lobby_joined", data: { userId: "server-user" } });
    client.emit("battle:lobby_join", { userId: "client-supplied-user" });

    expect(connected).toHaveBeenCalledOnce();
    expect(joined).toHaveBeenCalledWith({ userId: "server-user" });
    expect(JSON.parse(ws.sent[0]!)).toEqual({ event: "battle:lobby_join", data: { userId: "client-supplied-user" } });
    client.disconnect();
  });

  it("uses the current browser origin when the local API base is empty", () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.stubGlobal("window", { location: { origin: "http://localhost:18081" } });
    const client = createGoRealtimeClient("", "/ws/battle");
    expect(String(FakeWebSocket.instances[0]!.url)).toBe("ws://localhost:18081/ws/battle");
    client.disconnect();
  });

  it("uses the canonical Go presence endpoint", () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.stubGlobal("window", { location: { origin: "http://localhost:18081" } });
    const client = createGoRealtimeClient("", "/ws/presence");
    expect(String(FakeWebSocket.instances[0]!.url)).toBe("ws://localhost:18081/ws/presence");
    client.disconnect();
  });

  it("bounds reconnects even when each reconnect opens and then drops", () => {
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const client = createGoRealtimeClient("http://localhost:4001", "/ws/battle");
    for (let i = 0; i < 4; i += 1) {
      FakeWebSocket.instances[i]!.open();
      FakeWebSocket.instances[i]!.close();
      vi.runOnlyPendingTimers();
    }
    expect(FakeWebSocket.instances).toHaveLength(4);
    client.disconnect();
  });

  it("restores the bounded reconnect budget after a stable connection", () => {
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const client = createGoRealtimeClient("http://localhost:4001", "/ws/battle");
    for (let i = 0; i < 5; i += 1) {
      FakeWebSocket.instances[i]!.open();
      vi.advanceTimersByTime(60_000);
      FakeWebSocket.instances[i]!.close();
      vi.advanceTimersByTime(250);
    }
    expect(FakeWebSocket.instances).toHaveLength(6);
    client.disconnect();
  });
});

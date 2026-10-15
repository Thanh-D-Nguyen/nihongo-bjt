export type GoRealtimeClient = {
  readonly connected: boolean;
  on<T = unknown>(event: string, listener: (payload: T) => void): void;
  once<T = unknown>(event: string, listener: (payload: T) => void): void;
  emit(event: string, data?: unknown): void;
  removeAllListeners(): void;
  disconnect(): void;
};

const reconnectResetAfterMs = 60_000;

export function createGoRealtimeClient(apiBase: string, path: "/ws/battle" | "/ws/presence"): GoRealtimeClient {
  const endpoint = new URL(path, apiBase || window.location.origin);
  endpoint.protocol = endpoint.protocol === "https:" ? "wss:" : "ws:";
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let stableTimer: ReturnType<typeof setTimeout> | null = null;
  let attempts = 0;
  let disconnected = false;

  const emitLocal = (event: string, payload?: unknown) => {
    for (const listener of listeners.get(event) ?? []) listener(payload);
  };

  const connect = () => {
    if (disconnected) return;
    ws = new WebSocket(endpoint);
    const current = ws;
    current.addEventListener("open", () => {
      emitLocal("connect");
      if (stableTimer) clearTimeout(stableTimer);
      stableTimer = setTimeout(() => {
        attempts = 0;
        stableTimer = null;
      }, reconnectResetAfterMs);
    });
    current.addEventListener("message", (event) => {
      if (typeof event.data !== "string") return;
      try {
        const message = JSON.parse(event.data) as { event?: unknown; data?: unknown };
        if (typeof message.event === "string") emitLocal(message.event, message.data);
      } catch {
        emitLocal("protocol_error");
      }
    });
    current.addEventListener("close", () => {
      if (stableTimer) clearTimeout(stableTimer);
      stableTimer = null;
      emitLocal("disconnect");
      if (!disconnected && attempts < 3) {
        reconnectTimer = setTimeout(() => {
          attempts += 1;
          connect();
        }, 250 * 2 ** attempts);
      }
    });
    current.addEventListener("error", () => current.close());
  };
  connect();

  return {
    get connected() { return ws?.readyState === WebSocket.OPEN; },
    on<T = unknown>(event: string, listener: (payload: T) => void) {
      const wrapped = listener as (payload: unknown) => void;
      const set = listeners.get(event) ?? new Set();
      set.add(wrapped);
      listeners.set(event, set);
    },
    once<T = unknown>(event: string, listener: (payload: T) => void) {
      const wrapped = (payload: unknown) => {
        listeners.get(event)?.delete(wrapped);
        listener(payload as T);
      };
      const set = listeners.get(event) ?? new Set();
      set.add(wrapped);
      listeners.set(event, set);
    },
    emit(event: string, data?: unknown) {
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ event, data }));
    },
    removeAllListeners() { listeners.clear(); },
    disconnect() {
      disconnected = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (stableTimer) clearTimeout(stableTimer);
      reconnectTimer = null;
      stableTimer = null;
      ws?.close();
    }
  };
}

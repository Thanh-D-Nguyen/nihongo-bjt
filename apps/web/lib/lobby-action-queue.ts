/**
 * Queue of socket actions that must wait for `battle:lobby_joined`.
 *
 * Actions are flushed once, in order, when the lobby is joined. An action that
 * never gets its turn within `timeoutMs` is dropped and reported through its
 * `onTimeout`, so callers can leave the "connecting" state instead of hanging.
 */
export interface LobbyActionQueueOptions {
  timeoutMs: number;
}

interface QueuedAction<S> {
  action: (socket: S) => void;
  onTimeout?: () => void;
  timer: ReturnType<typeof setTimeout> | undefined;
}

export interface LobbyActionQueue<S> {
  enqueue(action: (socket: S) => void, onTimeout?: () => void): void;
  /** Runs every queued action once, in order, with the joined socket. */
  flush(socket: S): void;
  /** Drops queued actions without running or reporting them (teardown). */
  clear(): void;
  readonly size: number;
}

export function createLobbyActionQueue<S>({ timeoutMs }: LobbyActionQueueOptions): LobbyActionQueue<S> {
  let entries: Array<QueuedAction<S>> = [];

  return {
    enqueue(action, onTimeout) {
      const entry: QueuedAction<S> = { action, onTimeout, timer: undefined };
      entry.timer = setTimeout(() => {
        if (!entries.includes(entry)) return;
        entries = entries.filter((item) => item !== entry);
        entry.onTimeout?.();
      }, timeoutMs);
      entries.push(entry);
    },
    flush(socket) {
      const batch = entries;
      entries = [];
      for (const entry of batch) {
        clearTimeout(entry.timer);
        try {
          entry.action(socket);
        } catch (error) {
          // One failing action must not strand the actions queued behind it.
          console.error("lobby action failed", error);
        }
      }
    },
    clear() {
      for (const entry of entries) clearTimeout(entry.timer);
      entries = [];
    },
    get size() {
      return entries.length;
    }
  };
}

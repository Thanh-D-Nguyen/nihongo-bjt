import { afterEach, describe, expect, it, vi } from "vitest";
import { createLobbyActionQueue } from "./lobby-action-queue";

describe("lobby action queue", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs queued actions once, in order, when the lobby is joined", () => {
    vi.useFakeTimers();
    const queue = createLobbyActionQueue<string>({ timeoutMs: 1000 });
    const calls: string[] = [];
    queue.enqueue((socket) => calls.push(`bot:${socket}`));
    queue.enqueue((socket) => calls.push(`accept:${socket}`));
    expect(queue.size).toBe(2);
    expect(calls).toEqual([]);

    queue.flush("s1");
    expect(calls).toEqual(["bot:s1", "accept:s1"]);
    expect(queue.size).toBe(0);

    queue.flush("s2");
    expect(calls).toHaveLength(2);
  });

  it("does not report a timeout for an action that was flushed in time", () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();
    const queue = createLobbyActionQueue<string>({ timeoutMs: 1000 });
    queue.enqueue(() => undefined, onTimeout);
    vi.advanceTimersByTime(500);
    queue.flush("s");
    vi.advanceTimersByTime(5000);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("drops an action that never gets the lobby and reports it once", () => {
    vi.useFakeTimers();
    const action = vi.fn();
    const onTimeout = vi.fn();
    const queue = createLobbyActionQueue<string>({ timeoutMs: 1000 });
    queue.enqueue(action, onTimeout);

    vi.advanceTimersByTime(999);
    expect(onTimeout).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(queue.size).toBe(0);

    queue.flush("late");
    expect(action).not.toHaveBeenCalled();
  });

  it("clear drops pending actions silently and cancels their timers", () => {
    vi.useFakeTimers();
    const action = vi.fn();
    const onTimeout = vi.fn();
    const queue = createLobbyActionQueue<string>({ timeoutMs: 1000 });
    queue.enqueue(action, onTimeout);
    queue.clear();
    vi.advanceTimersByTime(5000);
    queue.flush("s");
    expect(action).not.toHaveBeenCalled();
    expect(onTimeout).not.toHaveBeenCalled();
    expect(queue.size).toBe(0);
  });

  it("keeps running the remaining actions when one throws", () => {
    vi.useFakeTimers();
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const second = vi.fn();
    const queue = createLobbyActionQueue<string>({ timeoutMs: 1000 });
    queue.enqueue(() => {
      throw new Error("boom");
    });
    queue.enqueue(second);
    queue.flush("s");
    expect(second).toHaveBeenCalledWith("s");
    expect(errors).toHaveBeenCalled();
    errors.mockRestore();
  });
});

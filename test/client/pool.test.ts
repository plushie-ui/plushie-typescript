import { describe, expect, test, vi } from "vitest";
import { SessionPool } from "../../src/client/pool.js";

function route(pool: SessionPool, msg: Record<string, unknown>): void {
  (pool as unknown as { routeMessage: (msg: Record<string, unknown>) => void }).routeMessage(msg);
}

function hello(): Record<string, unknown> {
  return {
    type: "hello",
    protocol_version: 1,
    mode: "mock",
    name: "plushie-renderer",
    version: "test",
    backend: "mock",
    transport: "pool",
    session: "",
  };
}

describe("SessionPool hello routing", () => {
  test("replays cached process hello to sessions registered after it arrived", async () => {
    const pool = new SessionPool({ binary: "unused" });
    const firstSessionId = pool.register();
    const firstHandler = vi.fn();
    pool.onSessionMessage(firstSessionId, firstHandler);

    const msg = hello();
    route(pool, msg);

    expect(firstHandler).toHaveBeenCalledTimes(1);
    expect(firstHandler).toHaveBeenCalledWith(msg);

    const secondSessionId = pool.register();
    const secondHandler = vi.fn();
    pool.onSessionMessage(secondSessionId, secondHandler);

    expect(secondHandler).not.toHaveBeenCalled();

    await Promise.resolve();

    expect(secondHandler).toHaveBeenCalledTimes(1);
    expect(secondHandler).toHaveBeenCalledWith(msg);
    expect(firstHandler).toHaveBeenCalledTimes(1);
  });

  test("delivers process hello to every session already waiting for it", () => {
    const pool = new SessionPool({ binary: "unused" });
    const firstSessionId = pool.register();
    const secondSessionId = pool.register();
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();
    pool.onSessionMessage(firstSessionId, firstHandler);
    pool.onSessionMessage(secondSessionId, secondHandler);

    const msg = hello();
    route(pool, msg);

    expect(firstHandler).toHaveBeenCalledWith(msg);
    expect(secondHandler).toHaveBeenCalledWith(msg);
  });

  test("does not replay cached hello to a handler that was replaced before delivery", async () => {
    const pool = new SessionPool({ binary: "unused" });
    const msg = hello();
    route(pool, msg);

    const sessionId = pool.register();
    const staleHandler = vi.fn();
    const currentHandler = vi.fn();
    pool.onSessionMessage(sessionId, staleHandler);
    pool.onSessionMessage(sessionId, currentHandler);

    await Promise.resolve();

    expect(staleHandler).not.toHaveBeenCalled();
    expect(currentHandler).toHaveBeenCalledTimes(1);
    expect(currentHandler).toHaveBeenCalledWith(msg);
  });
});

describe("SessionPool unregister", () => {
  test("waits for session_closed before removing the session", async () => {
    const pool = new SessionPool({ binary: "unused" });
    const sessionId = pool.register();
    const originalHandler = vi.fn();
    pool.onSessionMessage(sessionId, originalHandler);

    const resolved = vi.fn();
    const unregistering = pool.unregister(sessionId).then(resolved);

    route(pool, {
      type: "reset_response",
      id: `reset_${sessionId}`,
      status: "ok",
      session: sessionId,
    });
    route(pool, {
      type: "event",
      family: "click",
      id: "save",
      session: sessionId,
    });
    await Promise.resolve();

    expect(resolved).not.toHaveBeenCalled();
    expect(originalHandler).toHaveBeenCalledWith({
      type: "event",
      family: "click",
      id: "save",
      session: sessionId,
    });
    expect(pool.getSessionHandler(sessionId)).not.toBeNull();

    route(pool, {
      type: "event",
      family: "session_closed",
      value: { reason: "reset" },
      session: sessionId,
    });

    await unregistering;
    expect(resolved).toHaveBeenCalled();
    expect(pool.getSessionHandler(sessionId)).toBeNull();
  });

  test("treats session_error as terminal", async () => {
    const pool = new SessionPool({ binary: "unused" });
    const sessionId = pool.register();

    const unregistering = pool.unregister(sessionId);

    route(pool, {
      type: "event",
      family: "session_error",
      value: { error: "panic" },
      session: sessionId,
    });

    await unregistering;
    expect(pool.getSessionHandler(sessionId)).toBeNull();
  });

  test("falls back when the renderer never sends a terminal lifecycle event", async () => {
    vi.useFakeTimers();
    try {
      const pool = new SessionPool({ binary: "unused" });
      const sessionId = pool.register();

      const unregistering = pool.unregister(sessionId);

      await vi.advanceTimersByTimeAsync(5000);
      await unregistering;

      expect(pool.getSessionHandler(sessionId)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

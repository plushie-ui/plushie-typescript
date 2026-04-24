import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, test, vi } from "vitest";
import type { AppConfig, AppDefinition } from "../../src/app.js";
import type { SessionPool } from "../../src/client/pool.js";
import { PROTOCOL_VERSION } from "../../src/client/protocol.js";
import { TestSession } from "../../src/testing/session.js";

function createSessionDouble(): {
  session: TestSession<unknown>;
  interact: ReturnType<typeof vi.fn>;
} {
  const session = Object.create(TestSession.prototype) as TestSession<unknown>;
  const interact = vi.fn().mockResolvedValue(undefined);
  const stubbed = session as unknown as {
    runtime: { tree: () => null };
    interact: typeof interact;
  };
  stubbed.runtime = { tree: () => null };
  stubbed.interact = interact;
  return { session, interact };
}

function createMessageSessionDouble(): {
  session: TestSession<unknown>;
  emit: (msg: Record<string, unknown>) => void;
  originalHandler: ReturnType<typeof vi.fn>;
  getCurrentHandler: () => ((msg: Record<string, unknown>) => void) | null;
} {
  const session = Object.create(TestSession.prototype) as TestSession<unknown>;
  const originalHandler = vi.fn();
  let currentHandler: ((msg: Record<string, unknown>) => void) | null = originalHandler;

  const stubbed = session as unknown as {
    pool: {
      getSessionHandler: (sessionId: string) => ((msg: Record<string, unknown>) => void) | null;
      onSessionMessage: (
        sessionId: string,
        handler: (msg: Record<string, unknown>) => void,
      ) => void;
      sendToSession: (sessionId: string, msg: Record<string, unknown>) => void;
    };
    runtime: { tree: () => null };
    sessionId: string;
    interactTimeoutMs: number;
    requestCounter: number;
  };

  stubbed.pool = {
    getSessionHandler: (_sessionId) => currentHandler,
    onSessionMessage: (_sessionId, handler) => {
      currentHandler = handler;
    },
    sendToSession: (_sessionId, _msg) => {},
  };
  stubbed.runtime = { tree: () => null };
  stubbed.sessionId = "test_session";
  stubbed.interactTimeoutMs = 15_000;
  stubbed.requestCounter = 0;

  return {
    session,
    emit: (msg) => currentHandler?.(msg),
    originalHandler,
    getCurrentHandler: () => currentHandler,
  };
}

class ResetPoolDouble {
  readonly sequence: string[] = [];
  readonly sent: Array<{ sessionId: string; msg: Record<string, unknown> }> = [];
  readonly unregistered: string[] = [];
  private nextSessionId = 1;
  private processHello: Record<string, unknown> | null = null;
  private readonly handlers = new Map<string, (msg: Record<string, unknown>) => void>();
  private readonly closeHandlers = new Map<string, (reason: string) => void>();
  private readonly unregisterResolvers = new Map<string, () => void>();

  register(): string {
    const id = `pool_${String(this.nextSessionId++)}`;
    this.sequence.push(`register ${id}`);
    return id;
  }

  async unregister(sessionId: string): Promise<void> {
    this.sequence.push(`unregister ${sessionId}`);
    return new Promise<void>((resolve) => {
      this.unregisterResolvers.set(sessionId, () => {
        this.sequence.push(`closed ${sessionId}`);
        this.unregistered.push(sessionId);
        this.handlers.delete(sessionId);
        this.closeHandlers.delete(sessionId);
        this.unregisterResolvers.delete(sessionId);
        resolve();
      });
    });
  }

  closeSession(sessionId: string): void {
    this.unregisterResolvers.get(sessionId)?.();
  }

  routeProcessHello(protocol = PROTOCOL_VERSION): void {
    const msg = {
      type: "hello",
      protocol_version: protocol,
      mode: "mock",
      name: "plushie-renderer",
      version: "test",
      backend: "mock",
      transport: "pool",
      extensions: [],
      native_widgets: [],
      widgets: [],
      widget_sets: [],
      session: "",
    };
    this.processHello = msg;

    for (const handler of this.handlers.values()) {
      handler(msg);
      break;
    }
  }

  sendToSession(sessionId: string, msg: Record<string, unknown>): void {
    const wireMsg: Record<string, unknown> = { ...msg, session: sessionId };
    this.sent.push({ sessionId, msg: wireMsg });

    if (wireMsg["type"] === "tree_hash") {
      queueMicrotask(() => {
        this.handlers.get(sessionId)?.({
          type: "tree_hash_response",
          id: wireMsg["id"],
          hash: "fresh-hash",
          session: sessionId,
        });
      });
    }
  }

  onSessionMessage(sessionId: string, handler: (msg: Record<string, unknown>) => void): void {
    this.handlers.set(sessionId, handler);
    const hello = this.processHello;
    if (hello) {
      queueMicrotask(() => {
        if (this.handlers.get(sessionId) === handler) {
          handler(hello);
        }
      });
    }
  }

  getSessionHandler(sessionId: string): ((msg: Record<string, unknown>) => void) | null {
    return this.handlers.get(sessionId) ?? null;
  }

  onSessionClose(sessionId: string, handler: (reason: string) => void): void {
    this.closeHandlers.set(sessionId, handler);
  }

  mode(): "mock" {
    return "mock";
  }
}

const resetAppConfig: AppConfig<{ count: number }> = {
  init: { count: 0 },
  view: () => ({
    id: "main",
    type: "window",
    props: { title: "Reset Test" },
    children: [],
  }),
  update: (state) => state,
};

async function createResetSession(): Promise<{
  session: TestSession<{ count: number }>;
  pool: ResetPoolDouble;
}> {
  const pool = new ResetPoolDouble();
  pool.routeProcessHello();
  const sessionId = pool.register();
  const session = new TestSession(
    resetAppConfig,
    pool as unknown as SessionPool,
    sessionId,
    "msgpack",
    "mock",
  );
  await session.start();
  pool.sequence.length = 0;
  pool.sent.length = 0;
  pool.unregistered.length = 0;
  return { session, pool };
}

function createTreeHashSessionDouble(
  mode: "mock" | "headless",
  hash: string,
): TestSession<unknown> {
  const session = Object.create(TestSession.prototype) as TestSession<unknown>;
  const stubbed = session as unknown as {
    treeHash: (name: string) => Promise<string>;
    mode: "mock" | "headless";
  };
  stubbed.treeHash = vi.fn().mockResolvedValue(hash);
  stubbed.mode = mode;
  return session;
}

async function withTempGoldenDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const originalCwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "plushie-tree-hash-"));

  try {
    process.chdir(dir);
    await fn(dir);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(dir, { recursive: true, force: true });
    vi.unstubAllEnvs();
  }
}

describe("TestSession canvas helpers", () => {
  test("send canonical canvas action names", async () => {
    const { session, interact } = createSessionDouble();

    await session.canvasPress("canvas", 10, 20, "left");
    await session.canvasRelease("canvas", 30, 40, "right");
    await session.canvasMove("canvas", 50, 60);
    await session.canvasMove("main#canvas/overlay", 70, 80);

    expect(interact).toHaveBeenNthCalledWith(
      1,
      "canvas_press",
      { by: "id", value: "canvas" },
      { x: 10, y: 20, button: "left" },
    );
    expect(interact).toHaveBeenNthCalledWith(
      2,
      "canvas_release",
      { by: "id", value: "canvas" },
      { x: 30, y: 40, button: "right" },
    );
    expect(interact).toHaveBeenNthCalledWith(
      3,
      "canvas_move",
      { by: "id", value: "canvas" },
      { x: 50, y: 60 },
    );
    expect(interact).toHaveBeenNthCalledWith(
      4,
      "canvas_move",
      { by: "id", value: "canvas/overlay", window_id: "main" },
      { x: 70, y: 80 },
    );
  });

  test("keeps key press and release actions unchanged", async () => {
    const { session, interact } = createSessionDouble();

    await session.press("enter");
    await session.release("enter");

    expect(interact).toHaveBeenNthCalledWith(1, "press", {}, { key: "Enter" });
    expect(interact).toHaveBeenNthCalledWith(2, "release", {}, { key: "Enter" });
  });
});

describe("TestSession temporary interceptors", () => {
  test("awaitAsync restores the original handler and rejects on unknown top-level messages", async () => {
    const { session, emit, originalHandler, getCurrentHandler } = createMessageSessionDouble();

    const pending = session.awaitAsync("done", 1000);
    emit({ type: "unknown_thing", session: "test_session" });

    await expect(pending).rejects.toThrow('Unknown top-level message type "unknown_thing"');
    expect(getCurrentHandler()).toBe(originalHandler);
  });

  test("treeHash restores the original handler and rejects on unknown top-level messages", async () => {
    const { session, emit, originalHandler, getCurrentHandler } = createMessageSessionDouble();

    const pending = session.treeHash("after_render");
    emit({ type: "unknown_thing", session: "test_session" });

    await expect(pending).rejects.toThrow('Unknown top-level message type "unknown_thing"');
    expect(getCurrentHandler()).toBe(originalHandler);
  });

  test("screenshot restores the original handler and rejects on unknown top-level messages", async () => {
    const { session, emit, originalHandler, getCurrentHandler } = createMessageSessionDouble();

    const pending = session.screenshot("home");
    emit({ type: "unknown_thing", session: "test_session" });

    await expect(pending).rejects.toThrow('Unknown top-level message type "unknown_thing"');
    expect(getCurrentHandler()).toBe(originalHandler);
  });

  test("interact restores the original handler and rejects on unknown top-level messages", async () => {
    const { session, emit, originalHandler, getCurrentHandler } = createMessageSessionDouble();

    const pending = session.click("save");
    emit({ type: "unknown_thing", session: "test_session" });

    await expect(pending).rejects.toThrow('Unknown top-level message type "unknown_thing"');
    expect(getCurrentHandler()).toBe(originalHandler);
  });

  test("interact uses the configured timeout", async () => {
    vi.useFakeTimers();
    try {
      const { session, originalHandler, getCurrentHandler } = createMessageSessionDouble();
      const stubbed = session as unknown as { interactTimeoutMs: number };
      stubbed.interactTimeoutMs = 25;

      const pending = session.click("save");
      const rejection = expect(pending).rejects.toThrow(
        "interact timed out: action=click selector=id=save",
      );
      await vi.advanceTimersByTimeAsync(24);

      expect(getCurrentHandler()).not.toBe(originalHandler);

      await vi.advanceTimersByTimeAsync(1);

      await rejection;
      expect(getCurrentHandler()).toBe(originalHandler);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("TestSession reset", () => {
  test("unregisters the old session and starts a fresh runtime", async () => {
    const { session, pool } = await createResetSession();

    const reset = session.reset();

    expect(pool.sequence).toEqual(["unregister pool_1"]);
    expect(pool.sent).toEqual([]);

    pool.closeSession("pool_1");
    await reset;

    expect(pool.sequence).toEqual(["unregister pool_1", "closed pool_1", "register pool_2"]);
    expect(pool.unregistered).toEqual(["pool_1"]);
    expect(pool.sent[0]).toMatchObject({
      sessionId: "pool_2",
      msg: { type: "settings", session: "pool_2" },
    });
    expect(pool.sent).toContainEqual(
      expect.objectContaining({
        sessionId: "pool_2",
        msg: expect.objectContaining({ type: "snapshot", session: "pool_2" }),
      }),
    );
  });

  test("uses the fresh session ID for later renderer operations", async () => {
    const { session, pool } = await createResetSession();

    const reset = session.reset();
    pool.closeSession("pool_1");
    await reset;
    pool.sent.length = 0;

    await expect(session.treeHash("after_reset")).resolves.toBe("fresh-hash");

    expect(pool.sent).toContainEqual({
      sessionId: "pool_2",
      msg: {
        type: "tree_hash",
        session: "pool_2",
        id: "test_1",
        name: "after_reset",
      },
    });
  });

  test("unregisters the fresh session when startup fails", async () => {
    const { session, pool } = await createResetSession();
    const mutableConfig = resetAppConfig as unknown as { requiredWidgets?: readonly string[] };
    mutableConfig.requiredWidgets = ["missing_widget"];

    try {
      const reset = session.reset();
      pool.closeSession("pool_1");
      await vi.waitFor(() => {
        expect(pool.sequence).toContain("unregister pool_2");
      });
      pool.closeSession("pool_2");
      await expect(reset).rejects.toThrow("missing required widgets");

      expect(pool.sequence).toEqual([
        "unregister pool_1",
        "closed pool_1",
        "register pool_2",
        "unregister pool_2",
        "closed pool_2",
      ]);
      expect(pool.unregistered).toEqual(["pool_1", "pool_2"]);
    } finally {
      delete mutableConfig.requiredWidgets;
    }
  });
});

describe("createSession", () => {
  test("unregisters the pool session when startup fails", async () => {
    vi.resetModules();

    const startError = new Error("start failed");
    const register = vi.fn(() => "pool_1");
    const startPool = vi.fn();
    const stopPoolMock = vi.fn();
    const unregister = vi.fn().mockResolvedValue(undefined);
    const startSession = vi.fn().mockRejectedValue(startError);
    const stopAndWait = vi.fn(async () => {
      await unregister("pool_1");
    });

    class SessionPoolDouble {
      register = register;
      start = startPool;
      stop = stopPoolMock;
      unregister = unregister;
      mode(): "mock" {
        return "mock";
      }
    }

    class TestSessionDouble {
      start = startSession;
      stopAndWait = stopAndWait;
    }

    vi.doMock("../../src/client/binary.js", () => ({
      resolveBinary: () => "unused",
    }));
    vi.doMock("../../src/client/pool.js", () => ({
      SessionPool: SessionPoolDouble,
    }));
    vi.doMock("../../src/testing/session.js", () => ({
      TestSession: TestSessionDouble,
    }));

    try {
      const { createSession, stopPool: stopGlobalPool } = await import(
        "../../src/testing/index.js"
      );
      const appDef = {
        config: resetAppConfig,
        run: vi.fn(),
      } as unknown as AppDefinition<unknown>;

      await expect(createSession(appDef)).rejects.toBe(startError);

      expect(startPool).toHaveBeenCalledOnce();
      expect(register).toHaveBeenCalledOnce();
      expect(startSession).toHaveBeenCalledOnce();
      expect(stopAndWait).toHaveBeenCalledOnce();
      expect(unregister).toHaveBeenCalledWith("pool_1");

      stopGlobalPool();
      expect(stopPoolMock).toHaveBeenCalledOnce();
    } finally {
      vi.doUnmock("../../src/client/binary.js");
      vi.doUnmock("../../src/client/pool.js");
      vi.doUnmock("../../src/testing/session.js");
      vi.resetModules();
    }
  });
});

describe("TestSession tree hash goldens", () => {
  test("missing goldens fail loudly without snapshot opt-in", async () => {
    await withTempGoldenDir(async () => {
      const session = createTreeHashSessionDouble("mock", "mock-hash");

      await expect(session.assertTreeHash("counter")).rejects.toThrow(
        'assertTreeHash: missing golden for "counter"',
      );

      expect(fs.existsSync(path.join("test", "golden", "counter.mock.sha256"))).toBe(false);
    });
  });

  test("mismatched goldens update when snapshot opt-in is enabled", async () => {
    await withTempGoldenDir(async () => {
      vi.stubEnv("PLUSHIE_UPDATE_SNAPSHOTS", "1");
      const goldenPath = path.join("test", "golden", "counter.mock.sha256");
      fs.mkdirSync(path.dirname(goldenPath), { recursive: true });
      fs.writeFileSync(goldenPath, "old-hash\n", "utf-8");

      const session = createTreeHashSessionDouble("mock", "new-hash");
      await session.assertTreeHash("counter");

      expect(fs.readFileSync(goldenPath, "utf-8")).toBe("new-hash\n");
    });
  });

  test("mismatched goldens fail without snapshot opt-in and stay unchanged", async () => {
    await withTempGoldenDir(async () => {
      const goldenPath = path.join("test", "golden", "counter.mock.sha256");
      fs.mkdirSync(path.dirname(goldenPath), { recursive: true });
      fs.writeFileSync(goldenPath, "old-hash\n", "utf-8");

      const session = createTreeHashSessionDouble("mock", "new-hash");

      await expect(session.assertTreeHash("counter")).rejects.toThrow(
        'assertTreeHash: hash mismatch for "counter"',
      );
      expect(fs.readFileSync(goldenPath, "utf-8")).toBe("old-hash\n");
    });
  });

  test("mock and headless backends use separate tree hash goldens", async () => {
    await withTempGoldenDir(async () => {
      vi.stubEnv("PLUSHIE_UPDATE_SNAPSHOTS", "1");

      const mockSession = createTreeHashSessionDouble("mock", "mock-hash");
      const headlessSession = createTreeHashSessionDouble("headless", "headless-hash");

      await mockSession.assertTreeHash("counter");
      await headlessSession.assertTreeHash("counter");

      expect(fs.readFileSync(path.join("test", "golden", "counter.mock.sha256"), "utf-8")).toBe(
        "mock-hash\n",
      );
      expect(fs.readFileSync(path.join("test", "golden", "counter.headless.sha256"), "utf-8")).toBe(
        "headless-hash\n",
      );

      vi.unstubAllEnvs();

      await expect(mockSession.assertTreeHash("counter")).resolves.toBeUndefined();
      await expect(headlessSession.assertTreeHash("counter")).resolves.toBeUndefined();
    });
  });
});

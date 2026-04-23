import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, test, vi } from "vitest";
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
  stubbed.requestCounter = 0;

  return {
    session,
    emit: (msg) => currentHandler?.(msg),
    originalHandler,
    getCurrentHandler: () => currentHandler,
  };
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

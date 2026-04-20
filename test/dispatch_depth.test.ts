/**
 * Tests for the `Command.dispatch` chain depth guard.
 *
 * `Command.dispatch` schedules a follow-up via `queueMicrotask`; a
 * pathological `update` that keeps returning another dispatch would
 * pump the microtask queue indefinitely and starve the event loop.
 * The runtime caps the chain at {@link DISPATCH_DEPTH_LIMIT} and
 * surfaces a typed `DispatchLoopExceeded` diagnostic when the guard
 * fires.
 */

import { describe, expect, test, vi } from "vitest";
import type { Transport, WireFormat } from "../src/client/transport.js";
import * as Command from "../src/command.js";
import { DISPATCH_DEPTH_LIMIT, Runtime } from "../src/runtime.js";

class FakeTransport implements Transport {
  readonly format: WireFormat = "msgpack";
  readonly sent: Record<string, unknown>[] = [];
  private messageHandlers: ((msg: Record<string, unknown>) => void)[] = [];
  private closeHandlers: ((reason: string) => void)[] = [];
  closed = false;

  send(msg: Record<string, unknown>): void {
    this.sent.push(msg);
  }

  onMessage(handler: (msg: Record<string, unknown>) => void): void {
    this.messageHandlers.push(handler);
  }

  onClose(handler: (reason: string) => void): void {
    this.closeHandlers.push(handler);
  }

  close(): void {
    this.closed = true;
    for (const h of this.closeHandlers) h("closed");
  }

  emit(msg: Record<string, unknown>): void {
    for (const h of this.messageHandlers) h(msg);
  }
}

describe("Command.dispatch depth guard", () => {
  test("executeCommand drops dispatch at the cap and emits typed diagnostic", async () => {
    const runtime = new Runtime(
      {
        init: { count: 0 },
        view: () => ({
          id: "main",
          type: "window" as const,
          props: {},
          children: [],
        }),
        update: (state: { count: number }) => state,
      } as never,
      new FakeTransport(),
    );

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Simulate being one dispatch past the cap by setting the chain
    // depth directly. The private `state` field lets the test drive
    // the guard without constructing a pathological update loop.
    const rtState = (runtime as unknown as { state: { dispatchDepth: number } }).state;
    rtState.dispatchDepth = DISPATCH_DEPTH_LIMIT;

    const cmd = Command.dispatch({ kind: "loop" }, (v) => v);
    (runtime as unknown as { executeCommand: (c: unknown) => void }).executeCommand(cmd);

    const logged = errorSpy.mock.calls.map((c) => String(c[0]));
    expect(logged.some((m) => m.includes("dispatch_loop_exceeded"))).toBe(true);
    expect(logged.some((m) => m.includes(String(DISPATCH_DEPTH_LIMIT + 1)))).toBe(true);

    errorSpy.mockRestore();
    runtime.stop();
  });

  test("executeCommand passes dispatch through under the cap", () => {
    const runtime = new Runtime(
      {
        init: { count: 0 },
        view: () => ({
          id: "main",
          type: "window" as const,
          props: {},
          children: [],
        }),
        update: (state: { count: number }) => state,
      } as never,
      new FakeTransport(),
    );

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const rtState = (runtime as unknown as { state: { dispatchDepth: number } }).state;
    rtState.dispatchDepth = 5;

    const cmd = Command.dispatch({ kind: "ok" }, (v) => v);
    (runtime as unknown as { executeCommand: (c: unknown) => void }).executeCommand(cmd);

    const logged = errorSpy.mock.calls.map((c) => String(c[0]));
    expect(logged.some((m) => m.includes("dispatch_loop_exceeded"))).toBe(false);

    errorSpy.mockRestore();
    runtime.stop();
  });
});

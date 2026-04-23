import { describe, expect, test } from "vitest";
import type { AppConfig } from "../src/app.js";
import { PROTOCOL_VERSION } from "../src/client/protocol.js";
import type { Transport, WireFormat } from "../src/client/transport.js";
import { Runtime } from "../src/runtime.js";

class FakeTransport implements Transport {
  readonly format: WireFormat = "msgpack";
  readonly sent: Record<string, unknown>[] = [];
  private messageHandler: ((msg: Record<string, unknown>) => void) | null = null;
  private closeHandlers: ((reason: string) => void)[] = [];

  send(msg: Record<string, unknown>): void {
    this.sent.push(msg);
  }

  onMessage(handler: (msg: Record<string, unknown>) => void): void {
    this.messageHandler = handler;
  }

  onClose(handler: (reason: string) => void): void {
    this.closeHandlers.push(handler);
  }

  close(): void {
    for (const handler of this.closeHandlers) handler("closed");
  }

  emit(msg: Record<string, unknown>): void {
    this.messageHandler?.(msg);
  }
}

function hello(): Record<string, unknown> {
  return {
    type: "hello",
    protocol_version: PROTOCOL_VERSION,
    mode: "mock",
    name: "plushie-renderer",
    version: "test",
    extensions: [],
    native_widgets: [],
    widgets: [],
    widget_sets: [],
    session: "",
  };
}

function appConfig(opts?: { readonly throwOnUpdate?: boolean }): AppConfig<{ count: number }> {
  return {
    init: [{ count: 0 }, [] as []],
    view: () => ({
      id: "main",
      type: "window" as const,
      props: { title: "Reinit Test" },
      children: [],
    }),
    update: (state: { count: number }, _event) => {
      if (opts?.throwOnUpdate) {
        throw new Error("boom");
      }
      return state;
    },
  };
}

async function startRuntime(
  opts?: Parameters<typeof appConfig>[0],
): Promise<{ runtime: Runtime<{ count: number }>; transport: FakeTransport }> {
  const transport = new FakeTransport();
  const runtime = new Runtime(appConfig(opts), transport);
  const started = runtime.start();
  transport.emit(hello());
  await started;
  return { runtime, transport };
}

describe("Runtime.reinit", () => {
  test("unregisters active effect stubs before sending the new snapshot", async () => {
    const { runtime, transport } = await startRuntime();

    const registered = runtime.registerEffectStub("clipboard_read", { text: "stub" });
    transport.emit({ type: "effect_stub_register_ack", kind: "clipboard_read", session: "" });
    await registered;

    transport.sent.length = 0;
    runtime.reinit();

    expect(transport.sent[0]).toMatchObject({
      type: "unregister_effect_stub",
      kind: "clipboard_read",
    });
    expect(transport.sent[1]).toMatchObject({ type: "snapshot" });

    runtime.stop();
  });

  test("rejects stale stub ack waiters during reinit and clears the pending slot", async () => {
    const { runtime, transport } = await startRuntime();

    const stale = runtime.registerEffectStub("clipboard_read", { text: "stale" });
    runtime.reinit();

    await expect(stale).rejects.toThrow('Effect stub "clipboard_read" was cleared during reinit');

    transport.emit({ type: "effect_stub_register_ack", kind: "clipboard_read", session: "" });

    const fresh = runtime.registerEffectStub("clipboard_read", { text: "fresh" });
    transport.emit({ type: "effect_stub_register_ack", kind: "clipboard_read", session: "" });
    await expect(fresh).resolves.toBeUndefined();

    runtime.stop();
  });

  test("ignores stale unregister ack while waiting for a fresh register ack after reinit", async () => {
    const { runtime, transport } = await startRuntime();

    const registered = runtime.registerEffectStub("clipboard_read", { text: "stub" });
    transport.emit({ type: "effect_stub_register_ack", kind: "clipboard_read", session: "" });
    await registered;

    runtime.reinit();

    let resolved = false;
    const fresh = runtime.registerEffectStub("clipboard_read", { text: "fresh" }).then(() => {
      resolved = true;
    });

    transport.emit({ type: "effect_stub_unregister_ack", kind: "clipboard_read", session: "" });
    await Promise.resolve();
    expect(resolved).toBe(false);

    transport.emit({ type: "effect_stub_register_ack", kind: "clipboard_read", session: "" });
    await fresh;
    expect(resolved).toBe(true);

    runtime.stop();
  });

  test("resets consecutiveErrors to zero on reinit", async () => {
    const { runtime } = await startRuntime({ throwOnUpdate: true });
    const state = runtime as unknown as { state: { consecutiveErrors: number } };

    runtime.injectEvent({
      kind: "system",
      type: "theme_changed",
      value: "dark",
    } as never);

    expect(state.state.consecutiveErrors).toBe(1);

    runtime.reinit();

    expect(state.state.consecutiveErrors).toBe(0);

    runtime.stop();
  });
});

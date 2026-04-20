/**
 * Tests for the `requiredWidgets` SDK handshake behaviour.
 *
 * The TypeScript SDK does a client-side pre-check during the hello
 * handshake: `requiredWidgets` names are compared against the
 * `extensions` array the renderer advertises in its hello reply.
 * Missing names cause `Runtime.start()` to reject with a descriptive
 * error. The wire Settings message itself does not carry the
 * requiredWidgets list; the SDK check is stricter than the
 * renderer's own validation pass.
 */

import { describe, expect, test } from "vitest";
import { PROTOCOL_VERSION } from "../src/client/protocol.js";
import type { Transport, WireFormat } from "../src/client/transport.js";
import { Runtime } from "../src/runtime.js";

// ---------------------------------------------------------------------------
// FakeTransport: captures sent messages and lets the test drive the
// hello reply. Messages are shaped as plain objects (no msgpack/json
// framing) because Runtime operates on decoded records.
// ---------------------------------------------------------------------------

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

  /** Simulate the renderer sending a message to the SDK. */
  emit(msg: Record<string, unknown>): void {
    for (const h of this.messageHandlers) h(msg);
  }
}

function hello(extensions: readonly string[]): Record<string, unknown> {
  return {
    type: "hello",
    protocol: PROTOCOL_VERSION,
    mode: "mock",
    name: "plushie-renderer",
    version: "test",
    extensions,
    native_widgets: [],
    session: "",
  };
}

function appConfig(requiredWidgets?: readonly string[]) {
  const base = {
    init: { count: 0 },
    view: () => ({
      id: "main",
      type: "window" as const,
      props: {},
      children: [],
    }),
    update: (s: { count: number }) => s,
  };
  // exactOptionalPropertyTypes is on: only attach requiredWidgets
  // when the caller supplied a value.
  return requiredWidgets === undefined ? base : { ...base, requiredWidgets };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("requiredWidgets handshake pre-check", () => {
  test("rejects when a required widget is missing from hello.extensions", async () => {
    const transport = new FakeTransport();
    const runtime = new Runtime(appConfig(["gauge", "custom_chart"]), transport);

    const started = runtime.start();
    // Renderer reports only one of the two required names.
    transport.emit(hello(["gauge"]));

    await expect(started).rejects.toThrow(/missing required extensions.*custom_chart/s);
    runtime.stop();
  });

  test("resolves when every required widget appears in hello.extensions", async () => {
    const transport = new FakeTransport();
    const runtime = new Runtime(appConfig(["gauge"]), transport);

    const started = runtime.start();
    transport.emit(hello(["gauge", "other_widget"]));

    await expect(started).resolves.toBeUndefined();
    runtime.stop();
  });

  test("resolves when requiredWidgets is not configured", async () => {
    const transport = new FakeTransport();
    const runtime = new Runtime(appConfig(), transport);

    const started = runtime.start();
    transport.emit(hello([]));

    await expect(started).resolves.toBeUndefined();
    runtime.stop();
  });
});

describe("requiredWidgets and the outgoing Settings message", () => {
  test("Settings payload does not carry required_widgets", async () => {
    // The TS SDK's authoritative check is the hello pre-check, so it
    // intentionally does not include required_widgets on the wire.
    // Pin that down: the Settings message emitted on start() must
    // not have the field.
    const transport = new FakeTransport();
    const runtime = new Runtime(appConfig(["gauge"]), transport);

    const started = runtime.start();
    transport.emit(hello(["gauge"]));
    await started;

    const settingsMsg = transport.sent.find((m) => m["type"] === "settings");
    expect(settingsMsg).toBeDefined();
    const settingsPayload = (settingsMsg as { settings: Record<string, unknown> }).settings;
    expect(settingsPayload).not.toHaveProperty("required_widgets");
    runtime.stop();
  });
});

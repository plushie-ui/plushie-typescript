/**
 * Tests for the `requiredWidgets` handshake behaviour.
 *
 * The TypeScript SDK forwards the configured widget names to the
 * renderer via the `required_widgets` field of the outgoing Settings
 * message. The renderer validates the list against its widget
 * registry and emits a `required_widgets_missing` diagnostic on
 * mismatch. The SDK does not pre-check against `hello.extensions`;
 * the renderer's registry is the source of truth, matching every
 * other plushie host SDK.
 */

import { describe, expect, test } from "vitest";
import { PROTOCOL_VERSION } from "../src/client/protocol.js";
import { Session } from "../src/client/session.js";
import type { Transport, WireFormat } from "../src/client/transport.js";
import { Runtime } from "../src/runtime.js";

// FakeTransport captures sent messages and lets the test drive the hello
// reply. Messages are shaped as plain objects because Runtime operates on
// decoded records.

class FakeTransport implements Transport {
  readonly format: WireFormat = "msgpack";
  readonly sent: Record<string, unknown>[] = [];
  private messageHandler: ((msg: Record<string, unknown>) => void) | null = null;
  private closeHandlers: ((reason: string) => void)[] = [];
  closed = false;

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
    this.closed = true;
    for (const h of this.closeHandlers) h("closed");
  }

  /** Simulate the renderer sending a message to the SDK. */
  emit(msg: Record<string, unknown>): void {
    this.messageHandler?.(msg);
  }

  getMessageHandler(): ((msg: Record<string, unknown>) => void) | null {
    return this.messageHandler;
  }
}

interface HelloCapabilities {
  readonly extensions?: readonly string[];
  readonly nativeWidgets?: readonly string[];
  readonly widgets?: readonly string[];
}

function hello(capabilities: HelloCapabilities = {}): Record<string, unknown> {
  return {
    type: "hello",
    protocol_version: PROTOCOL_VERSION,
    mode: "mock",
    name: "plushie-renderer",
    version: "test",
    extensions: capabilities.extensions ?? [],
    native_widgets: capabilities.nativeWidgets ?? [],
    widgets: capabilities.widgets ?? [],
    widget_sets: [],
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

describe("requiredWidgets handshake", () => {
  test("resolves even when hello.extensions omits a required name", async () => {
    // The SDK no longer pre-checks: the renderer owns this rule and
    // surfaces mismatches via a `required_widgets_missing` diagnostic
    // on the event stream.
    const transport = new FakeTransport();
    const runtime = new Runtime(appConfig(["gauge", "custom_chart"]), transport);

    const started = runtime.start();
    // Renderer reports only one of the two required names. The SDK
    // still resolves; the renderer will diagnose.
    transport.emit(hello({ nativeWidgets: ["gauge"] }));

    await expect(started).resolves.toBeUndefined();
    runtime.stop();
  });

  test("resolves when every required widget appears in hello.native_widgets", async () => {
    const transport = new FakeTransport();
    const runtime = new Runtime(appConfig(["gauge"]), transport);

    const started = runtime.start();
    transport.emit(hello({ nativeWidgets: ["gauge", "other_widget"] }));

    await expect(started).resolves.toBeUndefined();
    runtime.stop();
  });

  test("resolves when every required widget appears in hello.widgets", async () => {
    const transport = new FakeTransport();
    const runtime = new Runtime(appConfig(["gauge"]), transport);

    const started = runtime.start();
    transport.emit(hello({ widgets: ["gauge", "button"] }));

    await expect(started).resolves.toBeUndefined();
    runtime.stop();
  });

  test("resolves when required widget appears in legacy hello.extensions", async () => {
    const transport = new FakeTransport();
    const runtime = new Runtime(appConfig(["gauge"]), transport);

    const started = runtime.start();
    transport.emit(hello({ extensions: ["gauge"] }));

    await expect(started).resolves.toBeUndefined();
    runtime.stop();
  });

  test("resolves when requiredWidgets is not configured", async () => {
    const transport = new FakeTransport();
    const runtime = new Runtime(appConfig(), transport);

    const started = runtime.start();
    transport.emit(hello());

    await expect(started).resolves.toBeUndefined();
    runtime.stop();
  });

  test("rejects cleanly on unknown top-level messages during hello handshake", async () => {
    const transport = new FakeTransport();
    const runtime = new Runtime(appConfig(), transport);

    const started = runtime.start();
    const handshakeHandler = transport.getMessageHandler();
    transport.emit({ type: "unknown_thing", session: "" });

    await expect(started).rejects.toThrow('Unknown top-level message type "unknown_thing"');
    expect(transport.getMessageHandler()).not.toBe(handshakeHandler);
    runtime.stop();
  });
});

describe("Session requiredWidgets handshake", () => {
  test("resolves when a required widget appears in hello.native_widgets", async () => {
    const transport = new FakeTransport();
    const session = new Session(transport);

    const connected = session.connect({ requiredWidgets: ["gauge"], timeout: 100 });
    transport.emit(hello({ nativeWidgets: ["gauge"] }));

    await expect(connected).resolves.toMatchObject({ native_widgets: ["gauge"] });
    session.close();
  });

  test("resolves even when hello capabilities omit a required name", async () => {
    // Same rule as Runtime: the Session hands off validation to the
    // renderer and does not pre-check against hello capabilities.
    const transport = new FakeTransport();
    const session = new Session(transport);

    const connected = session.connect({ requiredWidgets: ["custom_chart"], timeout: 100 });
    transport.emit(hello({ nativeWidgets: ["gauge"] }));

    await expect(connected).resolves.toMatchObject({ native_widgets: ["gauge"] });
    session.close();
  });
});

describe("requiredWidgets and the outgoing Settings message", () => {
  test("Settings payload carries required_widgets when configured", async () => {
    const transport = new FakeTransport();
    const runtime = new Runtime(appConfig(["gauge", "custom_chart"]), transport);

    const started = runtime.start();
    transport.emit(hello({ nativeWidgets: ["gauge", "custom_chart"] }));
    await started;

    const settingsMsg = transport.sent.find((m) => m["type"] === "settings");
    expect(settingsMsg).toBeDefined();
    const settingsPayload = (settingsMsg as { settings: Record<string, unknown> }).settings;
    expect(settingsPayload["required_widgets"]).toEqual(["gauge", "custom_chart"]);
    runtime.stop();
  });

  test("Settings payload omits required_widgets when the list is empty", async () => {
    const transport = new FakeTransport();
    const runtime = new Runtime(appConfig(), transport);

    const started = runtime.start();
    transport.emit(hello());
    await started;

    const settingsMsg = transport.sent.find((m) => m["type"] === "settings");
    expect(settingsMsg).toBeDefined();
    const settingsPayload = (settingsMsg as { settings: Record<string, unknown> }).settings;
    expect(settingsPayload).not.toHaveProperty("required_widgets");
    runtime.stop();
  });

  test("Session Settings payload carries required_widgets when configured", async () => {
    const transport = new FakeTransport();
    const session = new Session(transport);

    const connected = session.connect({ requiredWidgets: ["gauge"], timeout: 100 });
    transport.emit(hello({ nativeWidgets: ["gauge"] }));
    await connected;

    const settingsMsg = transport.sent.find((m) => m["type"] === "settings");
    expect(settingsMsg).toBeDefined();
    const settingsPayload = (settingsMsg as { settings: Record<string, unknown> }).settings;
    expect(settingsPayload["required_widgets"]).toEqual(["gauge"]);
    session.close();
  });
});

/**
 * Tests for the `requiredWidgets` SDK handshake behaviour.
 *
 * The TypeScript SDK does a client-side pre-check during the hello
 * handshake: `requiredWidgets` names are compared against the
 * widget capabilities the renderer advertises in its hello reply.
 * Missing names cause `Runtime.start()` to reject with a descriptive
 * error. The wire Settings message itself does not carry the
 * requiredWidgets list; the SDK check is stricter than the
 * renderer's own validation pass.
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

describe("requiredWidgets handshake pre-check", () => {
  test("rejects when a required widget is missing from hello capabilities", async () => {
    const transport = new FakeTransport();
    const runtime = new Runtime(appConfig(["gauge", "custom_chart"]), transport);

    const started = runtime.start();
    // Renderer reports only one of the two required names.
    transport.emit(hello({ nativeWidgets: ["gauge"] }));

    await expect(started).rejects.toThrow(
      /missing required widgets or capabilities.*custom_chart/s,
    );
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

describe("Session requiredWidgets handshake pre-check", () => {
  test("resolves when a required widget appears in hello.native_widgets", async () => {
    const transport = new FakeTransport();
    const session = new Session(transport);

    const connected = session.connect({ requiredWidgets: ["gauge"], timeout: 100 });
    transport.emit(hello({ nativeWidgets: ["gauge"] }));

    await expect(connected).resolves.toMatchObject({ native_widgets: ["gauge"] });
    session.close();
  });

  test("resolves when a required widget appears in hello.widgets", async () => {
    const transport = new FakeTransport();
    const session = new Session(transport);

    const connected = session.connect({ requiredWidgets: ["gauge"], timeout: 100 });
    transport.emit(hello({ widgets: ["gauge"] }));

    await expect(connected).resolves.toMatchObject({ widgets: ["gauge"] });
    session.close();
  });

  test("rejects when a required widget is missing from hello capabilities", async () => {
    const transport = new FakeTransport();
    const session = new Session(transport);

    const connected = session.connect({ requiredWidgets: ["custom_chart"], timeout: 100 });
    transport.emit(hello({ nativeWidgets: ["gauge"] }));

    await expect(connected).rejects.toThrow(
      /missing required widgets or capabilities.*custom_chart/s,
    );
    session.close();
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
    transport.emit(hello({ nativeWidgets: ["gauge"] }));
    await started;

    const settingsMsg = transport.sent.find((m) => m["type"] === "settings");
    expect(settingsMsg).toBeDefined();
    const settingsPayload = (settingsMsg as { settings: Record<string, unknown> }).settings;
    expect(settingsPayload).not.toHaveProperty("required_widgets");
    runtime.stop();
  });
});

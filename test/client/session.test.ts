import { describe, expect, test } from "vitest";
import { Session } from "../../src/client/session.js";
import type { Transport, WireFormat } from "../../src/client/transport.js";

class FakeTransport implements Transport {
  readonly format: WireFormat = "msgpack";
  private messageHandler: ((msg: Record<string, unknown>) => void) | null = null;
  private closeHandler: ((reason: string) => void) | null = null;

  send(_msg: Record<string, unknown>): void {}

  onMessage(handler: (msg: Record<string, unknown>) => void): void {
    this.messageHandler = handler;
  }

  onClose(handler: (reason: string) => void): void {
    this.closeHandler = handler;
  }

  close(): void {
    this.closeHandler?.("closed");
  }

  emit(msg: Record<string, unknown>): void {
    this.messageHandler?.(msg);
  }
}

describe("Session", () => {
  test("throws when the renderer sends an unknown top-level message type", () => {
    const transport = new FakeTransport();
    const session = new Session(transport);

    expect(() => transport.emit({ type: "unknown_thing", session: "" })).toThrow(
      'Unknown top-level message type "unknown_thing"',
    );

    session.close();
  });
});

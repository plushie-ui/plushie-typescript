/**
 * Cross-SDK parity integration tests.
 *
 * Drives the real renderer end-to-end to guard against silent
 * wire-shape regressions on Settings handshake fields and on
 * channels that recently moved from `widget_op` to typed envelopes.
 */

import { describe, expect, test } from "vitest";
import type { DecodedResponse } from "../../src/client/protocol.js";
import { decodeMessage, encodeSettings, PROTOCOL_VERSION } from "../../src/client/protocol.js";
import { SpawnTransport } from "../../src/client/transport.js";
import { binaryAvailable, binaryPath } from "./setup.js";

function waitForMessage(
  transport: { onMessage(handler: (msg: Record<string, unknown>) => void): void },
  predicate: (decoded: DecodedResponse) => boolean,
  timeoutMs = 5000,
): Promise<DecodedResponse> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timed out waiting for message")), timeoutMs);
    transport.onMessage((raw) => {
      const decoded = decodeMessage(raw);
      if (decoded && predicate(decoded)) {
        clearTimeout(timer);
        resolve(decoded);
      }
    });
  });
}

/**
 * Drain incoming messages for a brief window, returning everything
 * received. Useful for asserting that a particular diagnostic did
 * NOT arrive (the renderer emits diagnostics asynchronously after
 * Settings parsing).
 */
function collectFor(
  transport: { onMessage(handler: (msg: Record<string, unknown>) => void): void },
  ms: number,
): Promise<DecodedResponse[]> {
  return new Promise((resolve) => {
    const collected: DecodedResponse[] = [];
    transport.onMessage((raw) => {
      const decoded = decodeMessage(raw);
      if (decoded) collected.push(decoded);
    });
    setTimeout(() => resolve(collected), ms);
  });
}

describe.skipIf(!binaryAvailable)("integration: cross-SDK parity", () => {
  test("default_font as a {family} object survives Settings parsing", async () => {
    const transport = new SpawnTransport({
      binary: binaryPath!,
      format: "json",
      args: ["--mock"],
    });

    try {
      const helloPromise = waitForMessage(transport, (d) => d.type === "hello");
      transport.send(
        encodeSettings("", { default_font: { family: "monospace" } }) as Record<string, unknown>,
      );
      const hello = await helloPromise;
      expect(hello.type).toBe("hello");
      if (hello.type === "hello") {
        expect(hello.data.protocol).toBe(PROTOCOL_VERSION);
      }

      // Give the renderer a moment to emit any deferred Settings
      // diagnostics. None should arrive for the canonical shape.
      const collected = await collectFor(transport, 150);
      const invalidSettings = collected.filter(
        (d) => d.type === "diagnostic" && d.data.diagnostic.kind === "invalid_settings",
      );
      expect(invalidSettings).toEqual([]);
    } finally {
      transport.close();
    }
  });
});

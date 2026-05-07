/**
 * Cross-SDK parity integration tests.
 *
 * Drives the real renderer end-to-end to guard against silent
 * wire-shape regressions on Settings handshake fields and on
 * channels that recently moved from `widget_op` to typed envelopes.
 */

import { describe, expect, test } from "vitest";
import type { DecodedResponse } from "../../src/client/protocol.js";
import {
  decodeMessage,
  encodeImageOp,
  encodeSettings,
  encodeSnapshot,
  PROTOCOL_VERSION,
} from "../../src/client/protocol.js";
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

  test("image_op list rides the typed channel and round-trips through the renderer", async () => {
    const transport = new SpawnTransport({
      binary: binaryPath!,
      format: "json",
      args: ["--mock"],
    });

    try {
      const helloPromise = waitForMessage(transport, (d) => d.type === "hello");
      transport.send(encodeSettings("", {}) as Record<string, unknown>);
      await helloPromise;

      // A snapshot keeps the session lively; not strictly required
      // for image_op but mirrors how a real app would interleave.
      transport.send(
        encodeSnapshot("", {
          id: "root",
          type: "text",
          props: { content: "ready" },
          children: [],
        }) as Record<string, unknown>,
      );

      // Send list via the typed image_op channel. The renderer
      // routes `list` to its existing list_images widget-op handler
      // and emits `op_query_response` with kind `"list_images"`.
      const listPromise = waitForMessage(
        transport,
        (d) => d.type === "op_query_response" && d.kind === "list_images",
      );
      transport.send(encodeImageOp("", "list", { tag: "inventory" }) as Record<string, unknown>);
      const listResp = await listPromise;
      expect(listResp.type).toBe("op_query_response");
      if (listResp.type === "op_query_response") {
        expect(listResp.tag).toBe("inventory");
        const data = listResp.data as Record<string, unknown>;
        expect(Array.isArray(data["handles"])).toBe(true);
      }
    } finally {
      transport.close();
    }
  });

  test("image_op clear rides the typed channel and the session stays healthy", async () => {
    const transport = new SpawnTransport({
      binary: binaryPath!,
      format: "json",
      args: ["--mock"],
    });

    try {
      const helloPromise = waitForMessage(transport, (d) => d.type === "hello");
      transport.send(encodeSettings("", {}) as Record<string, unknown>);
      await helloPromise;

      // Clear has no response, so the proof is "no diagnostic, list
      // still works after". Run the sequence and assert the follow-up
      // list returns an empty handle set.
      transport.send(encodeImageOp("", "clear", {}) as Record<string, unknown>);

      const listPromise = waitForMessage(
        transport,
        (d) => d.type === "op_query_response" && d.kind === "list_images",
      );
      transport.send(encodeImageOp("", "list", { tag: "after_clear" }) as Record<string, unknown>);
      const listResp = await listPromise;

      if (listResp.type === "op_query_response") {
        expect(listResp.tag).toBe("after_clear");
        const data = listResp.data as Record<string, unknown>;
        expect(data["handles"]).toEqual([]);
      }

      // No invalid_message diagnostic should have arrived for either send.
      const collected = await collectFor(transport, 100);
      const errors = collected.filter(
        (d) =>
          d.type === "diagnostic" &&
          (d.data.diagnostic.kind === "unknown_message_type" ||
            d.data.diagnostic.kind === "invalid_settings"),
      );
      expect(errors).toEqual([]);
    } finally {
      transport.close();
    }
  });
});

/**
 * Integration smoke test.
 *
 * Spawns the plushie binary in mock mode and exercises the basic
 * wire protocol handshake: settings -> hello -> snapshot -> interact.
 *
 * Skipped when no binary is available.
 */

import { describe, test, expect } from "vitest"
import { binaryAvailable, binaryPath } from "./setup.js"
import { SpawnTransport } from "../../src/client/transport.js"
import {
  encodeSettings, encodeSnapshot, encodeInteract,
  decodeMessage, PROTOCOL_VERSION,
} from "../../src/client/protocol.js"
import type { WireMessage, DecodedResponse } from "../../src/client/protocol.js"

function waitForMessage(
  transport: { onMessage(handler: (msg: Record<string, unknown>) => void): void },
  predicate: (decoded: DecodedResponse) => boolean,
  timeoutMs = 5000,
): Promise<DecodedResponse> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timed out waiting for message")), timeoutMs)
    transport.onMessage((raw) => {
      const decoded = decodeMessage(raw)
      if (decoded && predicate(decoded)) {
        clearTimeout(timer)
        resolve(decoded)
      }
    })
  })
}

describe.skipIf(!binaryAvailable)("integration: binary smoke test", () => {
  test("settings -> hello -> snapshot -> interact round trip", async () => {
    const transport = new SpawnTransport({
      binary: binaryPath!,
      format: "msgpack",
      args: ["--mock"],
    })

    try {
      // Wait for hello after sending settings
      const helloPromise = waitForMessage(transport, (d) => d.type === "hello")
      transport.send(encodeSettings("", {}) as Record<string, unknown>)
      const hello = await helloPromise

      expect(hello.type).toBe("hello")
      if (hello.type === "hello") {
        expect(hello.data.protocol).toBe(PROTOCOL_VERSION)
        expect(hello.data.mode).toBe("mock")
      }

      // Send a snapshot with a simple tree
      const tree: WireMessage = {
        id: "main",
        type: "window",
        props: { title: "Test" },
        children: [
          {
            id: "btn",
            type: "button",
            props: { label: "Click me" },
            children: [],
          },
        ],
      }
      transport.send(encodeSnapshot("", tree) as Record<string, unknown>)

      // Send an interact (click on the button)
      const interactPromise = waitForMessage(
        transport,
        (d) => d.type === "interact_response",
      )
      transport.send(
        encodeInteract("", "click-1", "click", { by: "id", value: "btn" }, {}) as Record<string, unknown>,
      )
      const response = await interactPromise

      expect(response.type).toBe("interact_response")
      if (response.type === "interact_response") {
        expect(response.id).toBe("click-1")
      }
    } finally {
      transport.close()
    }
  })
})

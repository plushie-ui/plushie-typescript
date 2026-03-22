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
  test("msgpack: settings -> hello -> snapshot -> interact round trip", async () => {
    const transport = new SpawnTransport({
      binary: binaryPath!,
      format: "msgpack",
      args: ["--mock"],
    })

    try {
      const helloPromise = waitForMessage(transport, (d) => d.type === "hello")
      transport.send(encodeSettings("", {}) as Record<string, unknown>)
      const hello = await helloPromise

      expect(hello.type).toBe("hello")
      if (hello.type === "hello") {
        expect(hello.data.protocol).toBe(PROTOCOL_VERSION)
        expect(hello.data.mode).toBe("mock")
        expect(hello.data.name).toBe("plushie")
      }

      // Send a tree with a button
      const tree: WireMessage = {
        id: "main",
        type: "window",
        props: { title: "Test" },
        children: [
          { id: "btn", type: "button", props: { label: "Click me" }, children: [] },
        ],
      }
      transport.send(encodeSnapshot("", tree) as Record<string, unknown>)

      // Click the button
      const interactPromise = waitForMessage(transport, (d) => d.type === "interact_response")
      transport.send(
        encodeInteract("", "click-1", "click", { by: "id", value: "btn" }, {}) as Record<string, unknown>,
      )
      const response = await interactPromise

      expect(response.type).toBe("interact_response")
      if (response.type === "interact_response") {
        expect(response.id).toBe("click-1")
        // Mock mode: click events are synthetic
        const events = response.events as WireMessage[]
        const clickEvent = events.find((e) => e["family"] === "click")
        expect(clickEvent).toBeDefined()
        expect(clickEvent?.["id"]).toBe("btn")
      }
    } finally {
      transport.close()
    }
  })

  test("json: settings -> hello -> query round trip", async () => {
    const transport = new SpawnTransport({
      binary: binaryPath!,
      format: "json",
      args: ["--mock"],
    })

    try {
      const helloPromise = waitForMessage(transport, (d) => d.type === "hello")
      transport.send(encodeSettings("", {}) as Record<string, unknown>)
      const hello = await helloPromise
      expect(hello.type).toBe("hello")

      // Send snapshot
      transport.send(encodeSnapshot("", {
        id: "root",
        type: "column",
        props: { spacing: 8 },
        children: [
          { id: "greeting", type: "text", props: { content: "Hello World" }, children: [] },
        ],
      }) as Record<string, unknown>)

      // Query for the text widget
      const queryPromise = waitForMessage(transport, (d) => d.type === "query_response")
      transport.send(
        { type: "query", session: "", id: "q1", target: "find", selector: { by: "id", value: "greeting" } },
      )
      const qResponse = await queryPromise

      expect(qResponse.type).toBe("query_response")
      if (qResponse.type === "query_response") {
        expect(qResponse.data).not.toBeNull()
        const node = qResponse.data as Record<string, unknown>
        expect(node["id"]).toBe("greeting")
        expect(node["type"]).toBe("text")
        const props = node["props"] as Record<string, unknown>
        expect(props["content"]).toBe("Hello World")
      }
    } finally {
      transport.close()
    }
  })

  test("text_input interact produces input events", async () => {
    const transport = new SpawnTransport({
      binary: binaryPath!,
      format: "json",
      args: ["--mock"],
    })

    try {
      const helloPromise = waitForMessage(transport, (d) => d.type === "hello")
      transport.send(encodeSettings("", {}) as Record<string, unknown>)
      await helloPromise

      transport.send(encodeSnapshot("", {
        id: "root",
        type: "column",
        props: {},
        children: [
          { id: "input", type: "text_input", props: { value: "", on_submit: true }, children: [] },
        ],
      }) as Record<string, unknown>)

      // Type text
      const typePromise = waitForMessage(transport, (d) => d.type === "interact_response")
      transport.send(
        encodeInteract("", "i1", "type_text", { by: "id", value: "input" }, { text: "hi" }) as Record<string, unknown>,
      )
      const response = await typePromise

      if (response.type === "interact_response") {
        const events = response.events as WireMessage[]
        const inputEvents = events.filter((e) => e["family"] === "input")
        expect(inputEvents.length).toBeGreaterThan(0)
        // Each character produces an input event
        expect(inputEvents[0]?.["id"]).toBe("input")
      }
    } finally {
      transport.close()
    }
  })

  test("checkbox toggle produces toggle event", async () => {
    const transport = new SpawnTransport({
      binary: binaryPath!,
      format: "json",
      args: ["--mock"],
    })

    try {
      const helloPromise = waitForMessage(transport, (d) => d.type === "hello")
      transport.send(encodeSettings("", {}) as Record<string, unknown>)
      await helloPromise

      transport.send(encodeSnapshot("", {
        id: "root",
        type: "column",
        props: {},
        children: [
          { id: "check", type: "checkbox", props: { label: "Agree", checked: false }, children: [] },
        ],
      }) as Record<string, unknown>)

      const togglePromise = waitForMessage(transport, (d) => d.type === "interact_response")
      transport.send(
        encodeInteract("", "i2", "toggle", { by: "id", value: "check" }, { value: true }) as Record<string, unknown>,
      )
      const response = await togglePromise

      if (response.type === "interact_response") {
        const events = response.events as WireMessage[]
        const toggleEvent = events.find((e) => e["family"] === "toggle")
        expect(toggleEvent).toBeDefined()
        expect(toggleEvent?.["id"]).toBe("check")
      }
    } finally {
      transport.close()
    }
  })

  test("reset clears session state", async () => {
    const transport = new SpawnTransport({
      binary: binaryPath!,
      format: "json",
      args: ["--mock"],
    })

    try {
      const helloPromise = waitForMessage(transport, (d) => d.type === "hello")
      transport.send(encodeSettings("", {}) as Record<string, unknown>)
      await helloPromise

      // Send a tree
      transport.send(encodeSnapshot("", {
        id: "root",
        type: "text",
        props: { content: "before reset" },
        children: [],
      }) as Record<string, unknown>)

      // Reset
      const resetPromise = waitForMessage(transport, (d) => d.type === "reset_response")
      transport.send({ type: "reset", session: "", id: "r1" })
      const resetResp = await resetPromise

      expect(resetResp.type).toBe("reset_response")

      // After reset, query should find nothing (no tree)
      const queryPromise = waitForMessage(transport, (d) => d.type === "query_response")
      transport.send({ type: "query", session: "", id: "q1", target: "find", selector: { by: "id", value: "root" } })
      const qResp = await queryPromise

      if (qResp.type === "query_response") {
        expect(qResp.data).toBeNull()
      }
    } finally {
      transport.close()
    }
  })
})

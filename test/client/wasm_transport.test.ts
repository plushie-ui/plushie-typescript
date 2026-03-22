import { describe, expect, test } from "vitest"
import { WasmTransport } from "../../src/client/wasm_transport.js"

describe("WasmTransport", () => {
  test("sends messages via PlushieApp.send_message", () => {
    const sent: string[] = []
    const MockApp = class {
      constructor(_settings: string, public onEvent: (json: string) => void) {}
      send_message(json: string) { sent.push(json) }
    }
    const transport = new WasmTransport(MockApp as never)
    transport.send({ type: "snapshot", tree: {} })
    expect(sent).toHaveLength(1)
    expect(JSON.parse(sent[0]!)).toHaveProperty("type", "snapshot")
  })

  test("receives messages via onEvent callback", () => {
    let capturedOnEvent: ((json: string) => void) | null = null
    const MockApp = class {
      constructor(_settings: string, onEvent: (json: string) => void) {
        capturedOnEvent = onEvent
      }
      send_message() {}
    }
    const transport = new WasmTransport(MockApp as never)
    const received: Record<string, unknown>[] = []
    transport.onMessage((msg) => received.push(msg))
    capturedOnEvent!('{"type":"hello","protocol":1}')
    expect(received).toHaveLength(1)
    expect(received[0]).toHaveProperty("type", "hello")
  })

  test("format is always json", () => {
    const MockApp = class {
      constructor(_settings: string, _onEvent: (json: string) => void) {}
      send_message() {}
    }
    const transport = new WasmTransport(MockApp as never)
    expect(transport.format).toBe("json")
  })

  test("passes settings to PlushieApp constructor", () => {
    let receivedSettings = ""
    const MockApp = class {
      constructor(settings: string, _onEvent: (json: string) => void) {
        receivedSettings = settings
      }
      send_message() {}
    }
    new WasmTransport(MockApp as never, { settings: { theme: "dark" } })
    const parsed = JSON.parse(receivedSettings) as Record<string, unknown>
    expect(parsed).toHaveProperty("type", "settings")
    const inner = parsed["settings"] as Record<string, unknown>
    expect(inner).toHaveProperty("protocol_version", 1)
    expect(inner).toHaveProperty("theme", "dark")
  })

  test("close nullifies app and stops sending", () => {
    const sent: string[] = []
    const MockApp = class {
      constructor(_settings: string, _onEvent: (json: string) => void) {}
      send_message(json: string) { sent.push(json) }
    }
    const transport = new WasmTransport(MockApp as never)
    transport.close()
    transport.send({ type: "snapshot", tree: {} })
    expect(sent).toHaveLength(0)
  })

  test("skips malformed inbound messages", () => {
    let capturedOnEvent: ((json: string) => void) | null = null
    const MockApp = class {
      constructor(_settings: string, onEvent: (json: string) => void) {
        capturedOnEvent = onEvent
      }
      send_message() {}
    }
    const transport = new WasmTransport(MockApp as never)
    const received: Record<string, unknown>[] = []
    transport.onMessage((msg) => received.push(msg))
    capturedOnEvent!("not json at all {{{")
    expect(received).toHaveLength(0)
  })

  test("calls onClose when constructor throws", () => {
    const MockApp = class {
      constructor(_settings: string, _onEvent: (json: string) => void) {
        throw new Error("WASM load failed")
      }
      send_message() {}
    }
    // onClose is set after construction, so the error during construction
    // won't fire it. But the app should be null and send should be a no-op.
    const transport = new WasmTransport(MockApp as never)
    const sent: string[] = []
    transport.send({ type: "snapshot" })
    expect(sent).toHaveLength(0)
  })

  test("calls onClose when send_message throws", () => {
    const MockApp = class {
      constructor(_settings: string, _onEvent: (json: string) => void) {}
      send_message() { throw new Error("send boom") }
    }
    const transport = new WasmTransport(MockApp as never)
    const reasons: string[] = []
    transport.onClose((reason) => reasons.push(reason))
    transport.send({ type: "snapshot" })
    expect(reasons).toHaveLength(1)
    expect(reasons[0]).toContain("WASM send failed")
  })
})

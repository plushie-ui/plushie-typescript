import { describe, expect, test } from "vitest"
import {
  encodePacket,
  decodePackets,
  encodeLine,
  decodeLines,
} from "../../src/client/framing.js"

// -- MessagePack framing --------------------------------------------------

describe("encodePacket", () => {
  test("prepends 4-byte big-endian length", () => {
    const payload = new Uint8Array([1, 2, 3])
    const framed = encodePacket(payload)
    expect(framed).toEqual(new Uint8Array([0, 0, 0, 3, 1, 2, 3]))
  })

  test("handles empty payload", () => {
    const framed = encodePacket(new Uint8Array([]))
    expect(framed).toEqual(new Uint8Array([0, 0, 0, 0]))
  })

  test("encodes a 256-byte payload length correctly", () => {
    const payload = new Uint8Array(256)
    const framed = encodePacket(payload)
    // 256 = 0x00000100
    expect(framed[0]).toBe(0)
    expect(framed[1]).toBe(0)
    expect(framed[2]).toBe(1)
    expect(framed[3]).toBe(0)
    expect(framed.byteLength).toBe(260)
  })

  test("rejects payloads exceeding 64 MiB", () => {
    // We can't allocate 64 MiB in a test, so test the boundary logic
    // by checking a payload just at the limit passes type-level checks.
    // The actual allocation would be tested in integration.
    expect(() => {
      // Create a mock that reports a huge byteLength
      const huge = { byteLength: 64 * 1024 * 1024 + 1 } as Uint8Array
      encodePacket(huge)
    }).toThrow(RangeError)
  })
})

describe("decodePackets", () => {
  test("decodes a single complete frame", () => {
    const data = new Uint8Array([0, 0, 0, 3, 97, 98, 99]) // "abc"
    const { messages, remaining } = decodePackets(data)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toEqual(new Uint8Array([97, 98, 99]))
    expect(remaining.byteLength).toBe(0)
  })

  test("decodes multiple complete frames", () => {
    // "abc" + "de"
    const data = new Uint8Array([
      0, 0, 0, 3, 97, 98, 99,
      0, 0, 0, 2, 100, 101,
    ])
    const { messages, remaining } = decodePackets(data)
    expect(messages).toHaveLength(2)
    expect(messages[0]).toEqual(new Uint8Array([97, 98, 99]))
    expect(messages[1]).toEqual(new Uint8Array([100, 101]))
    expect(remaining.byteLength).toBe(0)
  })

  test("returns partial frame as remaining", () => {
    // Header says 5 bytes but only 2 are present
    const data = new Uint8Array([0, 0, 0, 5, 104, 101])
    const { messages, remaining } = decodePackets(data)
    expect(messages).toHaveLength(0)
    expect(remaining).toEqual(data)
  })

  test("handles incomplete header", () => {
    // Only 3 bytes -- not enough for the 4-byte header
    const data = new Uint8Array([0, 0, 0])
    const { messages, remaining } = decodePackets(data)
    expect(messages).toHaveLength(0)
    expect(remaining).toEqual(data)
  })

  test("handles empty buffer", () => {
    const data = new Uint8Array([])
    const { messages, remaining } = decodePackets(data)
    expect(messages).toHaveLength(0)
    expect(remaining.byteLength).toBe(0)
  })

  test("handles complete frames followed by partial frame", () => {
    // "ab" complete, then partial header+data for next
    const data = new Uint8Array([
      0, 0, 0, 2, 97, 98, // "ab" complete
      0, 0, 0, 10, 99,    // next frame says 10 bytes but only 1 present
    ])
    const { messages, remaining } = decodePackets(data)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toEqual(new Uint8Array([97, 98]))
    expect(remaining).toEqual(new Uint8Array([0, 0, 0, 10, 99]))
  })

  test("handles zero-length frame", () => {
    const data = new Uint8Array([0, 0, 0, 0])
    const { messages, remaining } = decodePackets(data)
    expect(messages).toHaveLength(1)
    expect(messages[0]!.byteLength).toBe(0)
    expect(remaining.byteLength).toBe(0)
  })

  test("round-trips through encode/decode", () => {
    const payloads = [
      new Uint8Array([1, 2, 3]),
      new Uint8Array([4, 5]),
      new Uint8Array([]),
      new Uint8Array([255, 0, 128]),
    ]
    const encoded = new Uint8Array(
      payloads.reduce((acc, p) => {
        const framed = encodePacket(p)
        const merged = new Uint8Array(acc.byteLength + framed.byteLength)
        merged.set(acc)
        merged.set(framed, acc.byteLength)
        return merged
      }, new Uint8Array([])),
    )
    const { messages, remaining } = decodePackets(encoded)
    expect(messages).toHaveLength(payloads.length)
    for (let i = 0; i < payloads.length; i++) {
      expect(messages[i]).toEqual(payloads[i])
    }
    expect(remaining.byteLength).toBe(0)
  })
})

// -- JSON framing ---------------------------------------------------------

describe("encodeLine", () => {
  test("appends newline", () => {
    expect(encodeLine('{"type":"hello"}')).toBe('{"type":"hello"}\n')
  })

  test("handles empty string", () => {
    expect(encodeLine("")).toBe("\n")
  })
})

describe("decodeLines", () => {
  test("decodes multiple complete lines", () => {
    const { lines, remaining } = decodeLines('{"a":1}\n{"b":2}\n')
    expect(lines).toEqual(['{"a":1}', '{"b":2}'])
    expect(remaining).toBe("")
  })

  test("returns partial line as remaining", () => {
    const { lines, remaining } = decodeLines('{"a":1}\npartial')
    expect(lines).toEqual(['{"a":1}'])
    expect(remaining).toBe("partial")
  })

  test("handles no newline (entirely partial)", () => {
    const { lines, remaining } = decodeLines("partial data")
    expect(lines).toEqual([])
    expect(remaining).toBe("partial data")
  })

  test("handles empty string", () => {
    const { lines, remaining } = decodeLines("")
    expect(lines).toEqual([])
    expect(remaining).toBe("")
  })

  test("handles string that is just a newline", () => {
    const { lines, remaining } = decodeLines("\n")
    expect(lines).toEqual([""])
    expect(remaining).toBe("")
  })

  test("handles consecutive newlines", () => {
    const { lines, remaining } = decodeLines("a\n\nb\n")
    expect(lines).toEqual(["a", "", "b"])
    expect(remaining).toBe("")
  })

  test("round-trips through encode/decode", () => {
    const messages = ['{"type":"settings"}', '{"type":"snapshot"}']
    const buffer = messages.map(encodeLine).join("")
    const { lines, remaining } = decodeLines(buffer)
    expect(lines).toEqual(messages)
    expect(remaining).toBe("")
  })
})

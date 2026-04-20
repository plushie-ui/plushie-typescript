import { describe, expect, test } from "vitest";
import {
  BufferOverflowError,
  decodeLines,
  decodePackets,
  encodeLine,
  encodePacket,
  MAX_MESSAGE_SIZE,
} from "../../src/client/framing.js";

// -- MessagePack framing --------------------------------------------------

describe("encodePacket", () => {
  test("prepends 4-byte big-endian length", () => {
    const payload = new Uint8Array([1, 2, 3]);
    const framed = encodePacket(payload);
    expect(framed).toEqual(new Uint8Array([0, 0, 0, 3, 1, 2, 3]));
  });

  test("handles empty payload", () => {
    const framed = encodePacket(new Uint8Array([]));
    expect(framed).toEqual(new Uint8Array([0, 0, 0, 0]));
  });

  test("encodes a 256-byte payload length correctly", () => {
    const payload = new Uint8Array(256);
    const framed = encodePacket(payload);
    // 256 = 0x00000100
    expect(framed[0]).toBe(0);
    expect(framed[1]).toBe(0);
    expect(framed[2]).toBe(1);
    expect(framed[3]).toBe(0);
    expect(framed.byteLength).toBe(260);
  });

  test("rejects payloads exceeding 64 MiB with typed BufferOverflowError", () => {
    // We can't allocate 64 MiB in every test env, so use a mock that
    // reports a huge byteLength. The check should fire on the size
    // field before any byte access.
    const huge = { byteLength: MAX_MESSAGE_SIZE + 1 } as Uint8Array;

    let caught: unknown;
    try {
      encodePacket(huge);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(BufferOverflowError);
    const err = caught as BufferOverflowError;
    expect(err.size).toBe(MAX_MESSAGE_SIZE + 1);
    expect(err.limit).toBe(MAX_MESSAGE_SIZE);
  });
});

describe("decodePackets", () => {
  test("decodes a single complete frame", () => {
    const data = new Uint8Array([0, 0, 0, 3, 97, 98, 99]); // "abc"
    const { messages, remaining } = decodePackets(data);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual(new Uint8Array([97, 98, 99]));
    expect(remaining.byteLength).toBe(0);
  });

  test("decodes multiple complete frames", () => {
    // "abc" + "de"
    const data = new Uint8Array([0, 0, 0, 3, 97, 98, 99, 0, 0, 0, 2, 100, 101]);
    const { messages, remaining } = decodePackets(data);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual(new Uint8Array([97, 98, 99]));
    expect(messages[1]).toEqual(new Uint8Array([100, 101]));
    expect(remaining.byteLength).toBe(0);
  });

  test("returns partial frame as remaining", () => {
    // Header says 5 bytes but only 2 are present
    const data = new Uint8Array([0, 0, 0, 5, 104, 101]);
    const { messages, remaining } = decodePackets(data);
    expect(messages).toHaveLength(0);
    expect(remaining).toEqual(data);
  });

  test("handles incomplete header", () => {
    // Only 3 bytes; not enough for the 4-byte header
    const data = new Uint8Array([0, 0, 0]);
    const { messages, remaining } = decodePackets(data);
    expect(messages).toHaveLength(0);
    expect(remaining).toEqual(data);
  });

  test("handles empty buffer", () => {
    const data = new Uint8Array([]);
    const { messages, remaining } = decodePackets(data);
    expect(messages).toHaveLength(0);
    expect(remaining.byteLength).toBe(0);
  });

  test("handles complete frames followed by partial frame", () => {
    // "ab" complete, then partial header+data for next
    const data = new Uint8Array([
      0,
      0,
      0,
      2,
      97,
      98, // "ab" complete
      0,
      0,
      0,
      10,
      99, // next frame says 10 bytes but only 1 present
    ]);
    const { messages, remaining } = decodePackets(data);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual(new Uint8Array([97, 98]));
    expect(remaining).toEqual(new Uint8Array([0, 0, 0, 10, 99]));
  });

  test("handles zero-length frame", () => {
    const data = new Uint8Array([0, 0, 0, 0]);
    const { messages, remaining } = decodePackets(data);
    expect(messages).toHaveLength(1);
    expect(messages[0]!.byteLength).toBe(0);
    expect(remaining.byteLength).toBe(0);
  });

  test("round-trips through encode/decode", () => {
    const payloads = [
      new Uint8Array([1, 2, 3]),
      new Uint8Array([4, 5]),
      new Uint8Array([]),
      new Uint8Array([255, 0, 128]),
    ];
    const encoded = new Uint8Array(
      payloads.reduce((acc, p) => {
        const framed = encodePacket(p);
        const merged = new Uint8Array(acc.byteLength + framed.byteLength);
        merged.set(acc);
        merged.set(framed, acc.byteLength);
        return merged;
      }, new Uint8Array([])),
    );
    const { messages, remaining } = decodePackets(encoded);
    expect(messages).toHaveLength(payloads.length);
    for (let i = 0; i < payloads.length; i++) {
      expect(messages[i]).toEqual(payloads[i]);
    }
    expect(remaining.byteLength).toBe(0);
  });

  test("rejects oversized length prefix with typed BufferOverflowError", () => {
    // Craft a 4-byte header declaring MAX_MESSAGE_SIZE + 1 bytes.
    // The check fires on the prefix before payload bytes are consumed,
    // so no payload allocation is needed.
    const oversizedLen = MAX_MESSAGE_SIZE + 1;
    const header = new Uint8Array(4);
    const view = new DataView(header.buffer);
    view.setUint32(0, oversizedLen, false);

    let caught: unknown;
    try {
      decodePackets(header);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(BufferOverflowError);
    const err = caught as BufferOverflowError;
    expect(err.size).toBe(oversizedLen);
    expect(err.limit).toBe(MAX_MESSAGE_SIZE);
  });
});

// -- JSON framing ---------------------------------------------------------

describe("encodeLine", () => {
  test("appends newline", () => {
    expect(encodeLine('{"type":"hello"}')).toBe('{"type":"hello"}\n');
  });

  test("handles empty string", () => {
    expect(encodeLine("")).toBe("\n");
  });
});

describe("decodeLines", () => {
  test("decodes multiple complete lines", () => {
    const { lines, remaining } = decodeLines('{"a":1}\n{"b":2}\n');
    expect(lines).toEqual(['{"a":1}', '{"b":2}']);
    expect(remaining).toBe("");
  });

  test("returns partial line as remaining", () => {
    const { lines, remaining } = decodeLines('{"a":1}\npartial');
    expect(lines).toEqual(['{"a":1}']);
    expect(remaining).toBe("partial");
  });

  test("handles no newline (entirely partial)", () => {
    const { lines, remaining } = decodeLines("partial data");
    expect(lines).toEqual([]);
    expect(remaining).toBe("partial data");
  });

  test("handles empty string", () => {
    const { lines, remaining } = decodeLines("");
    expect(lines).toEqual([]);
    expect(remaining).toBe("");
  });

  test("handles string that is just a newline", () => {
    const { lines, remaining } = decodeLines("\n");
    expect(lines).toEqual([""]);
    expect(remaining).toBe("");
  });

  test("handles consecutive newlines", () => {
    const { lines, remaining } = decodeLines("a\n\nb\n");
    expect(lines).toEqual(["a", "", "b"]);
    expect(remaining).toBe("");
  });

  test("round-trips through encode/decode", () => {
    const messages = ['{"type":"settings"}', '{"type":"snapshot"}'];
    const buffer = messages.map(encodeLine).join("");
    const { lines, remaining } = decodeLines(buffer);
    expect(lines).toEqual(messages);
    expect(remaining).toBe("");
  });

  test("rejects oversized complete line with typed BufferOverflowError", () => {
    const oversizedLine = "x".repeat(MAX_MESSAGE_SIZE + 1) + "\n";

    let caught: unknown;
    try {
      decodeLines(oversizedLine);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(BufferOverflowError);
    const err = caught as BufferOverflowError;
    expect(err.size).toBe(MAX_MESSAGE_SIZE + 1);
    expect(err.limit).toBe(MAX_MESSAGE_SIZE);
  });

  test("rejects oversized partial tail with typed BufferOverflowError", () => {
    // Partial tail (no trailing newline) that has already grown past
    // the cap. An unterminated line must not silently grow the
    // caller's buffer without bound.
    const oversizedTail = "x".repeat(MAX_MESSAGE_SIZE + 1);

    let caught: unknown;
    try {
      decodeLines(oversizedTail);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(BufferOverflowError);
    const err = caught as BufferOverflowError;
    expect(err.size).toBe(MAX_MESSAGE_SIZE + 1);
    expect(err.limit).toBe(MAX_MESSAGE_SIZE);
  });
});

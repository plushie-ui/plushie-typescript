/**
 * Wire frame encoding and decoding for the plushie protocol.
 *
 * Transports that deliver raw byte streams need to frame protocol
 * messages. This module provides framing for both MessagePack (4-byte
 * length prefix) and JSON (newline delimiter) modes.
 *
 * ## MessagePack framing
 *
 * Each message is prefixed with a 4-byte big-endian unsigned integer
 * indicating the payload size:
 *
 *     [4 bytes: size as u32 BE][payload bytes]
 *
 * ## JSON framing
 *
 * Each message is terminated by a newline character. Messages must not
 * contain embedded newlines.
 *
 * @module
 */

// -- MessagePack framing (4-byte length prefix) ---------------------------

/** Header size in bytes for the length prefix. */
const HEADER_SIZE = 4;

/** Maximum message size (64 MiB, matching renderer limit). */
export const MAX_MESSAGE_SIZE = 64 * 1024 * 1024;

/**
 * Raised when a wire frame exceeds the protocol's per-message size
 * cap (64 MiB). Carries the offending size and the configured cap so
 * callers can surface the violation without string parsing. A frame
 * past the cap is always a protocol violation; the transport closes
 * rather than attempting to recover.
 */
export class BufferOverflowError extends RangeError {
  /** Offending frame size in bytes. */
  public readonly size: number;
  /** Configured cap in bytes. */
  public readonly limit: number;

  constructor(size: number, limit: number) {
    super(`wire frame of ${size} bytes exceeds ${limit} byte limit`);
    this.name = "BufferOverflowError";
    this.size = size;
    this.limit = limit;
  }
}

/**
 * Encode a binary payload with a 4-byte big-endian length prefix.
 *
 * @param payload - The raw message bytes to frame.
 * @returns A new Uint8Array containing the length prefix followed by the payload.
 * @throws {RangeError} If the payload exceeds the 64 MiB limit.
 *
 * @example
 * ```ts
 * const framed = encodePacket(new Uint8Array([1, 2, 3]))
 * // framed = [0, 0, 0, 3, 1, 2, 3]
 * ```
 */
export function encodePacket(payload: Uint8Array): Uint8Array {
  const size = payload.byteLength;
  if (size > MAX_MESSAGE_SIZE) {
    throw new BufferOverflowError(size, MAX_MESSAGE_SIZE);
  }
  const frame = new Uint8Array(HEADER_SIZE + size);
  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  view.setUint32(0, size, false); // big-endian
  frame.set(payload, HEADER_SIZE);
  return frame;
}

/**
 * Result of decoding length-prefixed packets from a byte buffer.
 */
export interface DecodePacketsResult {
  /** Complete message payloads extracted from the buffer. */
  readonly messages: Uint8Array[];
  /** Leftover bytes that don't form a complete frame yet. */
  readonly remaining: Uint8Array;
}

/**
 * Decode complete frames from accumulated bytes.
 *
 * Parses as many complete length-prefixed frames as possible from the
 * buffer. Returns the decoded payloads and any remaining bytes that
 * don't yet form a complete frame.
 *
 * @param buffer - Accumulated bytes from the transport.
 * @returns Complete messages and leftover bytes.
 *
 * @example
 * ```ts
 * // Two complete frames
 * const data = new Uint8Array([0,0,0,3, 97,98,99, 0,0,0,2, 100,101])
 * const { messages, remaining } = decodePackets(data)
 * // messages = [Uint8Array[97,98,99], Uint8Array[100,101]]
 * // remaining = Uint8Array[]
 *
 * // Partial frame
 * const partial = new Uint8Array([0,0,0,5, 104,101])
 * const result = decodePackets(partial)
 * // result.messages = []
 * // result.remaining = partial (unchanged)
 * ```
 */
export function decodePackets(buffer: Uint8Array): DecodePacketsResult {
  const messages: Uint8Array[] = [];
  let offset = 0;

  while (offset + HEADER_SIZE <= buffer.byteLength) {
    const view = new DataView(buffer.buffer, buffer.byteOffset + offset, HEADER_SIZE);
    const size = view.getUint32(0, false); // big-endian

    if (size > MAX_MESSAGE_SIZE) {
      // Oversize frame is a protocol violation: the renderer should
      // never emit beyond the cap. Raise a typed error so callers can
      // tear the transport down structurally instead of silently
      // clearing the buffer (the prior behaviour).
      throw new BufferOverflowError(size, MAX_MESSAGE_SIZE);
    }

    if (offset + HEADER_SIZE + size > buffer.byteLength) {
      // Incomplete frame; need more data.
      break;
    }

    const start = offset + HEADER_SIZE;
    messages.push(buffer.slice(start, start + size));
    offset = start + size;
  }

  const remaining = offset === 0 ? buffer : buffer.slice(offset);
  return { messages, remaining };
}

// -- JSON framing (newline-delimited) -------------------------------------

/** Shared encoder for byte-length calculations in JSONL framing. */
const UTF8_ENCODER = new TextEncoder();

/**
 * Return the UTF-8 byte length of a string.
 *
 * `String.length` is the UTF-16 code-unit count, not the UTF-8
 * byte count. Any code path that compares string size against
 * the wire-byte cap must use this helper so BMP and CJK text
 * (1 code unit expands to 3 UTF-8 bytes) isn't under-counted.
 */
export function utf8ByteLength(s: string): number {
  return UTF8_ENCODER.encode(s).byteLength;
}

/**
 * Encode a string payload with a trailing newline (JSONL mode).
 *
 * @param data - The JSON string to frame.
 * @returns The string with a trailing newline appended.
 * @throws {BufferOverflowError} If the encoded frame exceeds the 64 MiB limit.
 *
 * @example
 * ```ts
 * encodeLine('{"a":1}')
 * // => '{"a":1}\n'
 * ```
 */
export function encodeLine(data: string): string {
  // Count UTF-8 bytes rather than string length so the cap matches
  // the raw-byte limit the renderer enforces on its side of the
  // pipe. The +1 accounts for the trailing newline the caller is
  // about to transmit.
  const size = utf8ByteLength(data) + 1;
  if (size > MAX_MESSAGE_SIZE) {
    throw new BufferOverflowError(size, MAX_MESSAGE_SIZE);
  }
  return data + "\n";
}

/**
 * Result of decoding newline-delimited lines from a string buffer.
 */
export interface DecodeLinesResult {
  /** Complete lines (without the trailing newline). */
  readonly lines: string[];
  /** Remaining partial line that doesn't end with a newline yet. */
  readonly remaining: string;
}

/**
 * Decode complete lines from accumulated string data.
 *
 * Splits the buffer by newline characters and returns all complete
 * lines. The last segment (which may be empty if the buffer ends
 * with a newline) is returned as the remaining partial line.
 *
 * The size cap is measured in UTF-8 bytes, matching the other
 * SDKs and the renderer's wire-byte limit. `String.length` is
 * UTF-16 code units, which understates the byte count for BMP
 * and CJK text (1 code unit can expand to 3 UTF-8 bytes) and
 * overstates it for characters in the astral plane (surrogate
 * pairs count as 2 units but encode to 4 bytes).
 *
 * @param buffer - Accumulated string data from the transport.
 * @returns Complete lines and the leftover partial line.
 *
 * @example
 * ```ts
 * const { lines, remaining } = decodeLines('{"a":1}\n{"b":2}\npartial')
 * // lines = ['{"a":1}', '{"b":2}']
 * // remaining = 'partial'
 * ```
 */
export function decodeLines(buffer: string): DecodeLinesResult {
  const parts = buffer.split("\n");
  if (parts.length === 1) {
    // No newline found; entire buffer is a partial line. Guard the
    // tail so an unterminated line can't grow the caller's buffer
    // unboundedly across successive feeds.
    assertUtf8WithinCap(buffer);
    return { lines: [], remaining: buffer };
  }
  const remaining = parts.pop()!;
  for (const line of parts) {
    assertUtf8WithinCap(line);
  }
  assertUtf8WithinCap(remaining);
  return { lines: parts, remaining };
}

/**
 * Throw `BufferOverflowError` if the UTF-8 byte length of `s`
 * exceeds the per-message cap. Ignores the common small-string
 * case where the code-unit count alone stays well under cap;
 * otherwise measures the real byte count since CJK / emoji can
 * expand 1 UTF-16 code unit into 3 or 4 UTF-8 bytes.
 */
function assertUtf8WithinCap(s: string): void {
  // Fast path: even at the worst case of 4 UTF-8 bytes per code
  // unit, a string of this length can't exceed the cap. Avoids
  // allocating a byte array for every normal-sized line.
  if (s.length * 4 <= MAX_MESSAGE_SIZE) return;

  const size = utf8ByteLength(s);
  if (size > MAX_MESSAGE_SIZE) {
    throw new BufferOverflowError(size, MAX_MESSAGE_SIZE);
  }
}

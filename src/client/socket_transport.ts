/**
 * Transport over Unix socket or TCP connection.
 *
 * Used for connecting to a plushie instance running with --listen.
 * Same framing logic as SpawnTransport but over a network socket
 * instead of a child process's stdio.
 *
 * @module
 */

import { createConnection, type Socket } from "node:net"
import { encode, decode } from "@msgpack/msgpack"
import {
  encodePacket,
  decodePackets,
  encodeLine,
  decodeLines,
} from "./framing.js"
import type { Transport, WireFormat } from "./transport.js"

/** Options for SocketTransport. */
export interface SocketTransportOptions {
  /** Unix socket path or TCP address in "host:port" format. */
  address: string
  /** Wire format. Defaults to "msgpack". */
  format?: WireFormat
}

/**
 * Transport that connects to a plushie renderer over a Unix socket
 * or TCP connection.
 *
 * The renderer must be running with `--listen` to accept connections.
 * Handles the same wire framing (MessagePack length-prefix or JSONL)
 * as SpawnTransport and StdioTransport.
 */
export class SocketTransport implements Transport {
  readonly format: WireFormat
  private socket: Socket | null = null
  private messageHandler: ((msg: Record<string, unknown>) => void) | null = null
  private closeHandler: ((reason: string) => void) | null = null
  private msgpackBuffer: Uint8Array<ArrayBufferLike> = new Uint8Array(0)
  private jsonBuffer = ""
  private closed = false

  constructor(opts: SocketTransportOptions) {
    this.format = opts.format ?? "msgpack"
    this.connect(opts.address)
  }

  private connect(address: string): void {
    // Determine if it's a TCP address (host:port) or Unix socket path.
    // A bare ":port" means localhost. Paths with colons (e.g. /tmp/plushie.sock)
    // are treated as Unix sockets -- TCP requires at least one char before the colon.
    const colonIdx = address.lastIndexOf(":")
    const looksLikeTcp =
      colonIdx > 0 &&
      !address.startsWith("/") &&
      /^\d+$/.test(address.slice(colonIdx + 1))

    if (looksLikeTcp) {
      const host = address.slice(0, colonIdx)
      const port = parseInt(address.slice(colonIdx + 1), 10)
      this.socket = createConnection({ host, port })
    } else if (address.startsWith(":")) {
      // Shorthand ":4567" -> localhost TCP
      const port = parseInt(address.slice(1), 10)
      this.socket = createConnection({ host: "127.0.0.1", port })
    } else {
      this.socket = createConnection({ path: address })
    }

    this.socket.on("data", (data: Buffer) => {
      if (this.format === "msgpack") {
        this.handleMsgpackData(data)
      } else {
        this.handleJsonData(data)
      }
    })

    this.socket.on("close", () => {
      if (!this.closed) {
        this.closeHandler?.("Socket closed")
      }
    })

    this.socket.on("error", (err) => {
      if (!this.closed) {
        this.closeHandler?.(`Socket error: ${err.message}`)
      }
    })
  }

  private handleMsgpackData(data: Buffer): void {
    const combined = new Uint8Array(this.msgpackBuffer.byteLength + data.byteLength)
    combined.set(this.msgpackBuffer)
    combined.set(Uint8Array.from(data), this.msgpackBuffer.byteLength)

    const { messages, remaining } = decodePackets(combined)
    this.msgpackBuffer = remaining

    for (const payload of messages) {
      try {
        const msg = decode(payload) as Record<string, unknown>
        this.messageHandler?.(msg)
      } catch {
        // Skip malformed messages
      }
    }
  }

  private handleJsonData(data: Buffer): void {
    this.jsonBuffer += data.toString("utf-8")
    const { lines, remaining } = decodeLines(this.jsonBuffer)
    this.jsonBuffer = remaining

    for (const line of lines) {
      if (line === "") continue
      try {
        const msg = JSON.parse(line) as Record<string, unknown>
        this.messageHandler?.(msg)
      } catch {
        // Skip malformed lines
      }
    }
  }

  send(msg: Record<string, unknown>): void {
    if (this.closed || !this.socket?.writable) return

    if (this.format === "msgpack") {
      const payload = encode(msg)
      this.socket.write(encodePacket(new Uint8Array(payload)))
    } else {
      const json = JSON.stringify(msg)
      this.socket.write(encodeLine(json), "utf-8")
    }
  }

  onMessage(handler: (msg: Record<string, unknown>) => void): void {
    this.messageHandler = handler
  }

  onClose(handler: (reason: string) => void): void {
    this.closeHandler = handler
  }

  close(): void {
    this.closed = true
    if (this.socket) {
      this.socket.end()
      this.socket = null
    }
  }
}

/**
 * Transport over Unix socket or TCP connection.
 *
 * Used for connecting to a plushie instance running with --listen.
 * Same framing logic as SpawnTransport but over a network socket
 * instead of a child process's stdio.
 *
 * @module
 */

import { createConnection, type Socket } from "node:net";
import { decode, encode } from "@msgpack/msgpack";
import { decodeLines, decodePackets, encodeLine, encodePacket } from "./framing.js";
import type { Transport, WireFormat } from "./transport.js";

type SocketTarget = { kind: "unix"; path: string } | { kind: "tcp"; host: string; port: number };

/** Options for SocketTransport. */
export interface SocketTransportOptions {
  /** Socket address: /path, :PORT, HOST:PORT, or [IPv6]:PORT. */
  address: string;
  /** Wire format. Defaults to "msgpack". */
  format?: WireFormat;
}

function parseSocketAddress(address: string): SocketTarget {
  const localhostTcp = /^:(\d+)$/u.exec(address);
  if (localhostTcp) {
    return {
      kind: "tcp",
      host: "127.0.0.1",
      port: Number.parseInt(localhostTcp[1]!, 10),
    };
  }

  const ipv6Tcp = /^\[([^\]]+)\]:(\d+)$/u.exec(address);
  if (ipv6Tcp) {
    return {
      kind: "tcp",
      host: ipv6Tcp[1]!,
      port: Number.parseInt(ipv6Tcp[2]!, 10),
    };
  }

  if (address.startsWith("[")) {
    throw new Error(
      `Invalid socket address "${address}". ` +
        "Use /path, :PORT, HOST:PORT, or [IPv6]:PORT. Bracketed addresses must include a numeric port.",
    );
  }

  const hostTcp = /^([^:]+):(\d+)$/u.exec(address);
  if (hostTcp) {
    return {
      kind: "tcp",
      host: hostTcp[1]!,
      port: Number.parseInt(hostTcp[2]!, 10),
    };
  }

  const bareIpv6Tcp = /^[^/[\]]*:[^/[\]]*:\d+$/u.test(address);
  if (bareIpv6Tcp) {
    throw new Error(
      `Invalid socket address "${address}". ` +
        "Use /path, :PORT, HOST:PORT, or [IPv6]:PORT. Bare IPv6 addresses must use brackets.",
    );
  }

  const windowsDrivePath = /^[A-Za-z]:[\\/]/u.test(address);
  if (
    !windowsDrivePath &&
    address.indexOf(":") === address.lastIndexOf(":") &&
    address.includes(":")
  ) {
    throw new Error(
      `Invalid socket address "${address}". ` +
        "Use /path, :PORT, HOST:PORT, or [IPv6]:PORT. TCP-style addresses must end with a numeric port.",
    );
  }

  return { kind: "unix", path: address };
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
  readonly format: WireFormat;
  private socket: Socket | null = null;
  private messageHandler: ((msg: Record<string, unknown>) => void) | null = null;
  private closeHandler: ((reason: string) => void) | null = null;
  private msgpackBuffer: Uint8Array<ArrayBufferLike> = new Uint8Array(0);
  private jsonBuffer = "";
  private closed = false;

  constructor(opts: SocketTransportOptions) {
    this.format = opts.format ?? "msgpack";
    this.connect(opts.address);
  }

  private connect(address: string): void {
    const target = parseSocketAddress(address);

    if (target.kind === "tcp") {
      this.socket = createConnection({ host: target.host, port: target.port });
    } else {
      this.socket = createConnection({ path: target.path });
    }

    this.socket.on("data", (data: Buffer) => {
      if (this.format === "msgpack") {
        this.handleMsgpackData(data);
      } else {
        this.handleJsonData(data);
      }
    });

    this.socket.on("close", () => {
      if (!this.closed) {
        this.closeHandler?.("Socket closed");
      }
    });

    this.socket.on("error", (err) => {
      if (!this.closed) {
        this.closeHandler?.(`Socket error: ${err.message}`);
      }
    });
  }

  private handleMsgpackData(data: Buffer): void {
    const combined = new Uint8Array(this.msgpackBuffer.byteLength + data.byteLength);
    combined.set(this.msgpackBuffer);
    combined.set(Uint8Array.from(data), this.msgpackBuffer.byteLength);

    const { messages, remaining } = decodePackets(combined);
    this.msgpackBuffer = remaining;

    for (const payload of messages) {
      try {
        const msg = decode(payload) as Record<string, unknown>;
        this.messageHandler?.(msg);
      } catch {
        // Skip malformed messages
      }
    }
  }

  private handleJsonData(data: Buffer): void {
    this.jsonBuffer += data.toString("utf-8");
    const { lines, remaining } = decodeLines(this.jsonBuffer);
    this.jsonBuffer = remaining;

    for (const line of lines) {
      if (line === "") continue;
      try {
        const msg = JSON.parse(line) as Record<string, unknown>;
        this.messageHandler?.(msg);
      } catch {
        // Skip malformed lines
      }
    }
  }

  send(msg: Record<string, unknown>): void {
    if (this.closed || !this.socket?.writable) return;

    if (this.format === "msgpack") {
      const payload = encode(msg);
      this.socket.write(encodePacket(new Uint8Array(payload)));
    } else {
      const json = JSON.stringify(msg);
      this.socket.write(encodeLine(json), "utf-8");
    }
  }

  onMessage(handler: (msg: Record<string, unknown>) => void): void {
    this.messageHandler = handler;
  }

  onClose(handler: (reason: string) => void): void {
    this.closeHandler = handler;
  }

  close(): void {
    this.closed = true;
    if (this.socket) {
      this.socket.end();
      this.socket = null;
    }
  }
}

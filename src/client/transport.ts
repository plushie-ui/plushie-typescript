/**
 * Transport layer for communicating with the plushie binary.
 *
 * Provides the `Transport` interface and implementations:
 * - `SpawnTransport`: spawns the binary as a child process (production)
 * - `StdioTransport`: uses process stdin/stdout for renderer-parent stdio mode
 * - `PooledTransport`: multiplexed session in a shared binary (testing)
 *
 * @module
 */

import { type ChildProcess, spawn } from "node:child_process";
import process from "node:process";
import { decode, encode } from "@msgpack/msgpack";
import { buildRendererEnv } from "./env.js";
import {
  BufferOverflowError,
  decodeLines,
  decodePackets,
  encodeLine,
  encodePacket,
} from "./framing.js";

/** Wire format: MessagePack (binary, length-prefixed) or JSON (text, newline-delimited). */
export type WireFormat = "msgpack" | "json";

/**
 * Transport interface for communicating with the renderer.
 *
 * The runtime doesn't know or care what's behind the transport --
 * it could be a standalone binary, a pooled session, or a custom
 * adapter.
 */
export interface Transport {
  /** Send a message to the renderer. */
  send(msg: Record<string, unknown>): void;
  /** Register a handler for incoming messages. */
  onMessage(handler: (msg: Record<string, unknown>) => void): void;
  /** Register a handler for transport close/error. */
  onClose(handler: (reason: string) => void): void;
  /** Close the transport and kill the child process if applicable. */
  close(): void;
  /** The wire format in use. */
  readonly format: WireFormat;
}

/** Options for SpawnTransport. */
export interface SpawnTransportOptions {
  /** Path to the plushie binary. */
  binary: string;
  /** Wire format. Defaults to "msgpack". */
  format?: WireFormat;
  /** Additional CLI arguments for the binary. */
  args?: string[];
  /** Override RUST_LOG for the renderer. */
  rustLog?: string;
}

/**
 * Transport that spawns the plushie binary as a child process.
 *
 * Handles wire framing (MessagePack length-prefix or JSONL),
 * environment whitelisting, and process lifecycle.
 */
export class SpawnTransport implements Transport {
  readonly format: WireFormat;
  private child: ChildProcess | null = null;
  private messageHandler: ((msg: Record<string, unknown>) => void) | null = null;
  private closeHandler: ((reason: string) => void) | null = null;
  private msgpackBuffer: Uint8Array<ArrayBufferLike> = new Uint8Array(0);
  private jsonBuffer = "";
  private closed = false;

  constructor(private readonly opts: SpawnTransportOptions) {
    this.format = opts.format ?? "msgpack";
    this.start();
  }

  private start(): void {
    const args = [...(this.opts.args ?? [])];
    if (this.format === "json") args.push("--json");

    const envOpts = this.opts.rustLog !== undefined ? { rustLog: this.opts.rustLog } : undefined;
    const env = buildRendererEnv(envOpts);

    this.child = spawn(this.opts.binary, args, {
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Forward stderr to console.error (renderer logs)
    this.child.stderr?.on("data", (data: Buffer) => {
      process.stderr.write(data);
    });

    // Handle stdout data
    this.child.stdout?.on("data", (data: Buffer) => {
      if (this.format === "msgpack") {
        this.handleMsgpackData(data);
      } else {
        this.handleJsonData(data);
      }
    });

    // Handle process exit
    this.child.on("exit", (code, signal) => {
      if (!this.closed) {
        const reason = signal
          ? `Renderer killed by signal ${signal}`
          : `Renderer exited with code ${String(code ?? "unknown")}`;
        this.closeHandler?.(reason);
      }
    });

    this.child.on("error", (err) => {
      if (!this.closed) {
        this.closeHandler?.(`Renderer process error: ${err.message}`);
      }
    });
  }

  private handleMsgpackData(data: Buffer): void {
    // Append to buffer
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
        // Skip malformed messages (renderer is resilient too)
      }
    }
  }

  private handleJsonData(data: Buffer): void {
    this.jsonBuffer += data.toString("utf-8");
    let lines: string[];
    try {
      const decoded = decodeLines(this.jsonBuffer);
      lines = decoded.lines;
      this.jsonBuffer = decoded.remaining;
    } catch (err) {
      if (err instanceof BufferOverflowError) {
        // A complete line or unterminated tail exceeded the 64 MiB cap.
        // Clear the buffer and drop the data; the renderer is expected
        // to stay within the protocol cap, so this is a defensive log.
        console.error(
          `[plushie] JSON buffer exceeded ${err.limit} bytes (${err.size}), dropping data`,
        );
        this.jsonBuffer = "";
        return;
      }
      throw err;
    }

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
    if (this.closed || !this.child?.stdin?.writable) return;

    if (this.format === "msgpack") {
      const payload = encode(msg);
      const framed = encodePacket(new Uint8Array(payload));
      this.child.stdin.write(framed);
    } else {
      const json = JSON.stringify(msg);
      this.child.stdin.write(encodeLine(json), "utf-8");
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
    const child = this.child;
    if (child) {
      this.child = null;
      child.stdin?.end();

      const exitTimeout = setTimeout(() => {
        child.kill("SIGKILL");
      }, 5000);

      child.on("exit", () => {
        clearTimeout(exitTimeout);
      });

      child.kill();
    }
  }
}

/** Options for StdioTransport. */
export interface StdioTransportOptions {
  /** Wire format. Defaults to "msgpack". */
  format?: WireFormat;
}

/**
 * Transport that reads from process.stdin and writes to process.stdout.
 *
 * Used when the renderer spawns the TypeScript process via structured exec args.
 * Same framing logic as SpawnTransport but on the process's own stdio
 * streams instead of a child process.
 */
export class StdioTransport implements Transport {
  readonly format: WireFormat;
  private messageHandler: ((msg: Record<string, unknown>) => void) | null = null;
  private closeHandler: ((reason: string) => void) | null = null;
  private msgpackBuffer: Uint8Array<ArrayBufferLike> = new Uint8Array(0);
  private jsonBuffer = "";
  private closed = false;

  constructor(opts?: StdioTransportOptions) {
    this.format = opts?.format ?? "msgpack";
    this.start();
  }

  private start(): void {
    process.stdin.on("data", (data: Buffer) => {
      if (this.format === "msgpack") {
        this.handleMsgpackData(data);
      } else {
        this.handleJsonData(data);
      }
    });

    process.stdin.on("end", () => {
      if (!this.closed) {
        this.closeHandler?.("stdin closed");
      }
    });

    process.stdin.on("error", (err) => {
      if (!this.closed) {
        this.closeHandler?.(`stdin error: ${err.message}`);
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
    let lines: string[];
    try {
      const decoded = decodeLines(this.jsonBuffer);
      lines = decoded.lines;
      this.jsonBuffer = decoded.remaining;
    } catch (err) {
      if (err instanceof BufferOverflowError) {
        console.error(
          `[plushie] JSON buffer exceeded ${err.limit} bytes (${err.size}), dropping data`,
        );
        this.jsonBuffer = "";
        return;
      }
      throw err;
    }

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
    if (this.closed || !process.stdout.writable) return;

    if (this.format === "msgpack") {
      const payload = encode(msg);
      const framed = encodePacket(new Uint8Array(payload));
      process.stdout.write(framed);
    } else {
      const json = JSON.stringify(msg);
      process.stdout.write(encodeLine(json), "utf-8");
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
  }
}

/**
 * Multiplexed session pool for the plushie binary.
 *
 * Manages a shared `plushie --mock --max-sessions N` process with
 * multiple isolated sessions. Each test gets its own session ID
 * for full state isolation.
 *
 * @module
 */

import { type ChildProcess, spawn } from "node:child_process";
import { decode, encode } from "@msgpack/msgpack";
import { buildRendererEnv } from "./env.js";
import { decodeLines, decodePackets, encodeLine, encodePacket } from "./framing.js";
import { encodeReset } from "./protocol.js";
import type { Transport, WireFormat } from "./transport.js";

/** Options for starting a session pool. */
export interface PoolOptions {
  /** Path to the plushie binary. */
  binary: string;
  /** Renderer mode: "mock" or "headless". Defaults to "mock". */
  mode?: "mock" | "headless";
  /** Wire format. Defaults to "msgpack". */
  format?: WireFormat;
  /** Maximum concurrent sessions. Defaults to 8. */
  maxSessions?: number;
}

/** A session registered with the pool. */
interface PoolSession {
  readonly id: string;
  messageHandler: ((msg: Record<string, unknown>) => void) | null;
  closeHandler: ((reason: string) => void) | null;
}

/**
 * A pool of multiplexed sessions sharing a single renderer process.
 *
 * Used by the test framework to run tests in parallel without
 * spawning a separate binary per test.
 */
export class SessionPool {
  private child: ChildProcess | null = null;
  private sessions = new Map<string, PoolSession>();
  private nextSessionId = 1;
  private msgpackBuffer: Uint8Array<ArrayBufferLike> = new Uint8Array(0);
  private jsonBuffer = "";
  private readonly opts: Required<PoolOptions>;
  private started = false;

  constructor(opts: PoolOptions) {
    this.opts = {
      binary: opts.binary,
      mode: opts.mode ?? "mock",
      format: opts.format ?? "msgpack",
      maxSessions: opts.maxSessions ?? 8,
    };
  }

  /** Start the shared renderer process. */
  start(): void {
    if (this.started) return;
    this.started = true;

    const args = [`--${this.opts.mode}`, "--max-sessions", String(this.opts.maxSessions)];
    if (this.opts.format === "json") args.push("--json");

    const env = buildRendererEnv();

    this.child = spawn(this.opts.binary, args, {
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.child.stderr?.on("data", (data: Buffer) => {
      process.stderr.write(data);
    });

    this.child.stdout?.on("data", (data: Buffer) => {
      if (this.opts.format === "msgpack") {
        this.handleMsgpackData(data);
      } else {
        this.handleJsonData(data);
      }
    });

    this.child.on("exit", (_code, _signal) => {
      for (const session of this.sessions.values()) {
        session.closeHandler?.("Pool process exited");
      }
    });
  }

  /** Stop the shared renderer process. */
  stop(): void {
    const child = this.child;
    if (child) {
      this.child = null;
      this.sessions.clear();
      this.started = false;

      child.stdin?.end();

      const exitTimeout = setTimeout(() => {
        child.kill("SIGKILL");
      }, 5000);

      child.on("exit", () => {
        clearTimeout(exitTimeout);
      });

      child.kill();
    } else {
      this.sessions.clear();
      this.started = false;
    }
  }

  /** Register a new session and return its ID. */
  register(): string {
    const id = `pool_${String(this.nextSessionId++)}`;
    this.sessions.set(id, {
      id,
      messageHandler: null,
      closeHandler: null,
    });
    return id;
  }

  /**
   * Unregister a session. Sends a Reset message and waits for
   * the reset_response before removing.
   */
  async unregister(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    return new Promise<void>((resolve) => {
      // Send reset and wait for response
      const resetId = `reset_${sessionId}`;
      const originalHandler = session.messageHandler;

      session.messageHandler = (msg) => {
        if (msg["type"] === "reset_response" && msg["id"] === resetId) {
          this.sessions.delete(sessionId);
          resolve();
        } else {
          originalHandler?.(msg);
        }
      };

      this.sendRaw(sessionId, encodeReset(sessionId, resetId));

      // Timeout fallback: don't block forever
      setTimeout(() => {
        this.sessions.delete(sessionId);
        resolve();
      }, 5000);
    });
  }

  /** Send a message to a specific session. */
  sendToSession(sessionId: string, msg: Record<string, unknown>): void {
    this.sendRaw(sessionId, { ...msg, session: sessionId });
  }

  /** Register a message handler for a session. */
  onSessionMessage(sessionId: string, handler: (msg: Record<string, unknown>) => void): void {
    const session = this.sessions.get(sessionId);
    if (session) session.messageHandler = handler;
  }

  /** Get the current message handler for a session (for test framework access). */
  getSessionHandler(sessionId: string): ((msg: Record<string, unknown>) => void) | null {
    const session = this.sessions.get(sessionId);
    return session?.messageHandler ?? null;
  }

  /** Get the renderer mode the pool is actually running. */
  mode(): "mock" | "headless" {
    return this.opts.mode;
  }

  /** Register a close handler for a session. */
  onSessionClose(sessionId: string, handler: (reason: string) => void): void {
    const session = this.sessions.get(sessionId);
    if (session) session.closeHandler = handler;
  }

  // -- Internal -----------------------------------------------------------

  private sendRaw(sessionId: string, msg: Record<string, unknown>): void {
    if (!this.child?.stdin?.writable) return;
    const wireMsg = { ...msg, session: sessionId };

    if (this.opts.format === "msgpack") {
      const payload = encode(wireMsg);
      const framed = encodePacket(new Uint8Array(payload));
      this.child.stdin.write(framed);
    } else {
      const json = JSON.stringify(wireMsg);
      this.child.stdin.write(encodeLine(json), "utf-8");
    }
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
        this.routeMessage(msg);
      } catch {
        // Skip malformed
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
        this.routeMessage(msg);
      } catch {
        // Skip malformed
      }
    }
  }

  private routeMessage(msg: Record<string, unknown>): void {
    const sessionId = typeof msg["session"] === "string" ? msg["session"] : "";

    // Route to specific session
    const session = this.sessions.get(sessionId);
    if (session?.messageHandler) {
      session.messageHandler(msg);
      return;
    }

    // Hello message (session "") is process-level, broadcast to first session
    if (sessionId === "" && msg["type"] === "hello") {
      for (const s of this.sessions.values()) {
        s.messageHandler?.(msg);
        break;
      }
    }
  }
}

/**
 * A Transport implementation backed by a SessionPool.
 *
 * Implements the Transport interface so the Runtime can connect
 * to a pooled session transparently.
 */
export class PooledTransport implements Transport {
  readonly format: WireFormat;
  private readonly pool: SessionPool;
  private readonly sessionId: string;

  constructor(pool: SessionPool, sessionId: string, format: WireFormat = "msgpack") {
    this.pool = pool;
    this.sessionId = sessionId;
    this.format = format;
  }

  send(msg: Record<string, unknown>): void {
    this.pool.sendToSession(this.sessionId, msg);
  }

  onMessage(handler: (msg: Record<string, unknown>) => void): void {
    this.pool.onSessionMessage(this.sessionId, handler);
  }

  onClose(handler: (reason: string) => void): void {
    this.pool.onSessionClose(this.sessionId, handler);
  }

  close(): void {
    // Don't close the pool; just unregister the session
    void this.pool.unregister(this.sessionId);
  }
}

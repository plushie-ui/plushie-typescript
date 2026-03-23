/**
 * Session management for the plushie wire protocol.
 *
 * Wraps a Transport with session-aware message handling:
 * - Hello handshake with protocol version validation
 * - Request/response correlation by ID
 * - Session field injection on outgoing messages
 * - Event stream for incoming events
 *
 * @module
 */

import type { DecodedResponse, HelloInfo, WireMessage } from "./protocol.js";
import { decodeMessage, PROTOCOL_VERSION } from "./protocol.js";
import type { Transport } from "./transport.js";

/** Options for connecting a session. */
export interface ConnectOptions {
  /** Renderer settings to send on startup. */
  settings?: Record<string, unknown>;
  /** Session identifier (defaults to "" for single-session mode). */
  sessionId?: string;
  /** Connection timeout in milliseconds (defaults to 10000). */
  timeout?: number;
}

/** Pending request awaiting a response. */
interface PendingRequest {
  readonly responseType: string;
  readonly resolve: (response: DecodedResponse) => void;
  readonly reject: (error: Error) => void;
}

/**
 * A connected session to the plushie renderer.
 *
 * Handles the hello handshake, request/response correlation,
 * and event dispatching.
 */
export class Session {
  private readonly transport: Transport;
  private readonly sessionId: string;
  private pendingRequests = new Map<string, PendingRequest>();
  private eventHandler: ((event: DecodedResponse) => void) | null = null;
  private nextRequestId = 1;

  /** Information from the renderer's hello handshake. */
  hello: HelloInfo | null = null;

  constructor(transport: Transport, sessionId = "") {
    this.transport = transport;
    this.sessionId = sessionId;

    transport.onMessage((raw) => {
      this.handleMessage(raw);
    });
  }

  /**
   * Connect to the renderer: send Settings and await hello.
   *
   * @param opts - Connection options.
   * @returns Hello information from the renderer.
   * @throws {Error} If the hello handshake times out or protocol version mismatches.
   */
  async connect(opts: ConnectOptions = {}): Promise<HelloInfo> {
    const timeout = opts.timeout ?? 10_000;
    const settings = opts.settings ?? {};

    return new Promise<HelloInfo>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new Error(
            `Renderer did not respond with hello within ${timeout}ms. ` +
              `Check that the binary is valid and the wire format is correct.`,
          ),
        );
      }, timeout);

      // Temporarily intercept messages to catch the hello
      const originalHandler = this.eventHandler;
      this.eventHandler = (response) => {
        if (response.type === "hello") {
          clearTimeout(timer);
          this.eventHandler = originalHandler;

          const info = response.data;
          if (info.protocol !== PROTOCOL_VERSION) {
            reject(
              new Error(
                `Protocol version mismatch: renderer reports ${String(info.protocol)}, ` +
                  `SDK expects ${String(PROTOCOL_VERSION)}. ` +
                  `Update the plushie binary or SDK to matching versions.`,
              ),
            );
            return;
          }

          this.hello = info;
          resolve(info);
        } else {
          // Forward non-hello messages that arrive during handshake
          originalHandler?.(response);
        }
      };

      // Send settings
      this.send({
        type: "settings",
        settings: { protocol_version: PROTOCOL_VERSION, ...settings },
      });
    });
  }

  /**
   * Send a fire-and-forget message to the renderer.
   * The session field is injected automatically.
   */
  send(msg: WireMessage): void {
    this.transport.send({ session: this.sessionId, ...msg });
  }

  /**
   * Send a request and await the matching response.
   *
   * @param msg - The request message (id will be auto-generated if not present).
   * @param responseType - The expected response message type.
   * @param timeout - Timeout in milliseconds (defaults to 30000).
   * @returns The decoded response.
   */
  async sendRequest(
    msg: WireMessage,
    responseType: string,
    timeout = 30_000,
  ): Promise<DecodedResponse> {
    const id = (msg["id"] as string | undefined) ?? this.generateId();
    const fullMsg = { session: this.sessionId, ...msg, id };

    return new Promise<DecodedResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request ${responseType} (id: ${id}) timed out after ${timeout}ms`));
      }, timeout);

      this.pendingRequests.set(id, {
        responseType,
        resolve: (response) => {
          clearTimeout(timer);
          resolve(response);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });

      this.transport.send(fullMsg);
    });
  }

  /**
   * Register a handler for incoming events and responses that
   * don't match a pending request.
   */
  onEvent(handler: (response: DecodedResponse) => void): void {
    this.eventHandler = handler;
  }

  /** Generate a unique request ID. */
  private generateId(): string {
    return `req_${String(this.nextRequestId++)}`;
  }

  /** Route an incoming message to pending requests or event handler. */
  private handleMessage(raw: Record<string, unknown>): void {
    const decoded = decodeMessage(raw);
    if (decoded === null) return;

    // Check if this matches a pending request
    const id = (raw["id"] as string | undefined) ?? "";
    if (id && this.pendingRequests.has(id)) {
      const pending = this.pendingRequests.get(id)!;
      this.pendingRequests.delete(id);
      pending.resolve(decoded);
      return;
    }

    // Forward to event handler
    this.eventHandler?.(decoded);
  }

  /** Close the underlying transport. */
  close(): void {
    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      pending.reject(new Error(`Session closed with pending request ${id}`));
    }
    this.pendingRequests.clear();
    this.transport.close();
  }
}

/**
 * Transport for communicating with the plushie WASM renderer in browser.
 *
 * Instead of spawning a child process, this transport loads the plushie
 * WASM module and communicates via in-memory JSON messages. The WASM
 * renderer runs in the same JavaScript context (or a Web Worker).
 *
 * Usage:
 *   import init, { PlushieApp } from 'plushie-wasm'
 *   import { WasmTransport } from 'plushie/client'
 *
 *   await init()  // Load WASM binary
 *   const transport = new WasmTransport(PlushieApp)
 *
 * @module
 */

import type { Transport, WireFormat } from "./transport.js";

/** The WASM PlushieApp constructor interface (from wasm-bindgen output). */
export interface PlushieAppConstructor {
  new (settingsJson: string, onEvent: (eventJson: string) => void): PlushieAppInstance;
}

/** The WASM PlushieApp instance interface. */
export interface PlushieAppInstance {
  send_message(json: string): void;
}

/** Options for WasmTransport. */
export interface WasmTransportOptions {
  /** Initial settings JSON to pass to the WASM constructor. */
  settings?: Record<string, unknown>;
}

/**
 * Transport backed by the plushie WASM renderer.
 *
 * Communication is always JSON (the WASM module doesn't support
 * msgpack framing). Messages are passed as JSON strings via the
 * PlushieApp API.
 */
export class WasmTransport implements Transport {
  readonly format: WireFormat = "json";
  private app: PlushieAppInstance | null = null;
  private messageHandler: ((msg: Record<string, unknown>) => void) | null = null;
  private closeHandler: ((reason: string) => void) | null = null;

  constructor(PlushieApp: PlushieAppConstructor, opts?: WasmTransportOptions) {
    const settings = opts?.settings ?? {};
    const settingsJson = JSON.stringify({
      type: "settings",
      session: "",
      settings: { protocol_version: 1, ...settings },
    });

    try {
      this.app = new PlushieApp(settingsJson, (eventJson: string) => {
        try {
          const msg = JSON.parse(eventJson) as Record<string, unknown>;
          this.messageHandler?.(msg);
        } catch {
          // Skip malformed messages
        }
      });
    } catch (err) {
      this.closeHandler?.(`WASM init failed: ${String(err)}`);
    }
  }

  send(msg: Record<string, unknown>): void {
    if (!this.app) return;
    try {
      this.app.send_message(JSON.stringify(msg));
    } catch (err) {
      this.closeHandler?.(`WASM send failed: ${String(err)}`);
    }
  }

  onMessage(handler: (msg: Record<string, unknown>) => void): void {
    this.messageHandler = handler;
  }

  onClose(handler: (reason: string) => void): void {
    this.closeHandler = handler;
  }

  close(): void {
    this.app = null;
  }
}

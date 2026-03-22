/**
 * Test session: a Runtime connected to a pooled mock renderer.
 *
 * Provides the API for interacting with an app in tests: click,
 * typeText, find, model, assertText, etc.
 *
 * @module
 */

import type { UINode, DeepReadonly, Event } from "../types.js"
import type { AppConfig } from "../app.js"
import type { WireNode } from "../tree/normalize.js"
import { Runtime } from "../runtime.js"
import { SessionPool, PooledTransport } from "../client/pool.js"
import type { WireFormat } from "../client/transport.js"
import {
  encodeQuery, encodeInteract, encodeSettings,
  decodeMessage,
  PROTOCOL_VERSION,
  type WireSelector,
  type WireMessage,
} from "../client/protocol.js"

/** Element returned by find queries. */
export interface Element {
  readonly id: string
  readonly type: string
  readonly props: Readonly<Record<string, unknown>>
  readonly children: readonly Element[]
  /** Extracted text from props.content, props.label, or props.value. */
  readonly text: string | null
}

/**
 * A test session wrapping a Runtime and a pooled renderer session.
 *
 * All interactions go through the real plushie binary in mock mode.
 */
export class TestSession<M> {
  private readonly runtime: Runtime<M>
  private readonly pool: SessionPool
  private readonly sessionId: string
  private requestCounter = 0

  constructor(
    config: AppConfig<M>,
    pool: SessionPool,
    sessionId: string,
    format: WireFormat,
  ) {
    this.pool = pool
    this.sessionId = sessionId
    const transport = new PooledTransport(pool, sessionId, format)
    this.runtime = new Runtime(config, transport, sessionId)
  }

  /** Start the test session (init + first render). */
  async start(): Promise<void> {
    await this.runtime.start()
  }

  /** Stop the test session. */
  stop(): void {
    this.runtime.stop()
  }

  /** Get the current model. */
  model(): DeepReadonly<M> {
    return this.runtime.model() as DeepReadonly<M>
  }

  /** Get the current normalized wire tree. */
  tree(): WireNode | null {
    return this.runtime.tree()
  }

  // =======================================================================
  // Interactions (send Interact to renderer, process response events)
  // =======================================================================

  /** Click a widget by ID. */
  async click(selector: string): Promise<void> {
    await this.interact("click", { by: "id", value: selector }, {})
  }

  /** Type text into a widget. */
  async typeText(selector: string, text: string): Promise<void> {
    await this.interact("type_text", { by: "id", value: selector }, { text })
  }

  /** Submit a text input (press Enter). */
  async submit(selector: string): Promise<void> {
    await this.interact("submit", { by: "id", value: selector }, {})
  }

  /** Toggle a checkbox. */
  async toggle(selector: string): Promise<void> {
    await this.interact("toggle", { by: "id", value: selector }, {})
  }

  /** Select a value from a pick list, combo box, or radio group. */
  async select(selector: string, value: string): Promise<void> {
    await this.interact("select", { by: "id", value: selector }, { value })
  }

  /** Set a slider value. */
  async slide(selector: string, value: number): Promise<void> {
    await this.interact("slide", { by: "id", value: selector }, { value })
  }

  /** Press a key (key down only). Supports "ctrl+s" format. */
  async press(key: string): Promise<void> {
    await this.interact("press", {}, { key })
  }

  /** Release a key (key up only). */
  async release(key: string): Promise<void> {
    await this.interact("release", {}, { key })
  }

  /** Press and release a key. */
  async typeKey(key: string): Promise<void> {
    await this.interact("type_key", {}, { key })
  }

  /** Move cursor to position. */
  async moveTo(x: number, y: number): Promise<void> {
    await this.interact("move_to", {}, { x, y })
  }

  // =======================================================================
  // Queries (send Query to renderer, await response)
  // =======================================================================

  /** Find a widget by ID. Returns null if not found. */
  async find(selector: string): Promise<Element | null> {
    return this.query({ by: "id", value: selector })
  }

  /** Find a widget by text content. */
  async findByText(text: string): Promise<Element | null> {
    return this.query({ by: "text", value: text })
  }

  /** Find a widget by accessibility role. */
  async findByRole(role: string): Promise<Element | null> {
    return this.query({ by: "role", value: role })
  }

  /** Find a widget by accessibility label. */
  async findByLabel(label: string): Promise<Element | null> {
    return this.query({ by: "label", value: label })
  }

  /** Find the currently focused widget. */
  async findFocused(): Promise<Element | null> {
    return this.query({ by: "focused" })
  }

  // =======================================================================
  // Assertions
  // =======================================================================

  /** Assert that a widget's text matches the expected value. */
  async assertText(selector: string, expected: string): Promise<void> {
    const el = await this.find(selector)
    if (!el) {
      throw new Error(`assertText: widget "${selector}" not found`)
    }
    const actual = el.text
    if (actual !== expected) {
      throw new Error(
        `assertText: expected "${expected}" but got "${String(actual)}" for widget "${selector}"`,
      )
    }
  }

  /** Assert that a widget exists. */
  async assertExists(selector: string): Promise<void> {
    const el = await this.find(selector)
    if (!el) {
      throw new Error(`assertExists: widget "${selector}" not found`)
    }
  }

  /** Assert that a widget does not exist. */
  async assertNotExists(selector: string): Promise<void> {
    const el = await this.find(selector)
    if (el) {
      throw new Error(`assertNotExists: widget "${selector}" unexpectedly found`)
    }
  }

  // =======================================================================
  // Internal
  // =======================================================================

  private async interact(
    action: string,
    selector: WireSelector | Record<string, never>,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const id = this.nextId()
    const msg = encodeInteract(this.sessionId, id, action, selector, payload)

    return new Promise<void>((resolve) => {
      const originalHandler = this.getMessageHandler()

      this.pool.onSessionMessage(this.sessionId, (raw) => {
        const decoded = decodeMessage(raw)
        if (!decoded) {
          originalHandler?.(raw)
          return
        }

        if (decoded.type === "interact_response" && (raw["id"] === id)) {
          // Process events from the response
          this.pool.onSessionMessage(this.sessionId, originalHandler ?? (() => {}))
          // In mock mode, events are in the response
          if (Array.isArray(decoded.events)) {
            for (const eventRaw of decoded.events) {
              this.injectEvent(eventRaw)
            }
          }
          resolve()
        } else if (decoded.type === "interact_step" && (raw["id"] === id)) {
          // Headless mode: process step events and send updated tree
          if (Array.isArray(decoded.events)) {
            for (const eventRaw of decoded.events) {
              this.injectEvent(eventRaw)
            }
          }
          // Runtime already re-rendered; send the current tree as snapshot
          const tree = this.runtime.tree()
          if (tree) {
            this.pool.sendToSession(
              this.sessionId,
              { type: "snapshot", session: this.sessionId, tree },
            )
          }
        } else {
          originalHandler?.(raw)
        }
      })

      this.pool.sendToSession(this.sessionId, msg)
    })
  }

  private async query(selector: WireSelector): Promise<Element | null> {
    const id = this.nextId()
    const msg = encodeQuery(this.sessionId, id, "find", selector)

    return new Promise<Element | null>((resolve) => {
      const originalHandler = this.getMessageHandler()

      this.pool.onSessionMessage(this.sessionId, (raw) => {
        if (raw["type"] === "query_response" && raw["id"] === id) {
          this.pool.onSessionMessage(this.sessionId, originalHandler ?? (() => {}))
          const data = raw["data"]
          if (data === null || data === undefined) {
            resolve(null)
          } else {
            resolve(wireNodeToElement(data as Record<string, unknown>))
          }
        } else {
          originalHandler?.(raw)
        }
      })

      this.pool.sendToSession(this.sessionId, msg)
    })
  }

  private injectEvent(eventRaw: WireMessage): void {
    // The runtime handles events internally via its message handler
    // We need to feed this event to the runtime's transport handler
    const handler = this.getMessageHandler()
    if (handler) {
      handler(eventRaw as Record<string, unknown>)
    }
  }

  private getMessageHandler(): ((msg: Record<string, unknown>) => void) | null {
    // Access the transport's message handler indirectly
    // The PooledTransport stores the handler on the pool
    const session = (this.pool as unknown as { sessions: Map<string, { messageHandler: ((msg: Record<string, unknown>) => void) | null }> }).sessions?.get(this.sessionId)
    return session?.messageHandler ?? null
  }

  private nextId(): string {
    return `test_${String(++this.requestCounter)}`
  }
}

function wireNodeToElement(raw: Record<string, unknown>): Element {
  const props = (raw["props"] ?? {}) as Record<string, unknown>
  const childrenRaw = (raw["children"] ?? []) as Array<Record<string, unknown>>

  // Extract text from common text-carrying props
  const text =
    (typeof props["content"] === "string" ? props["content"] : null) ??
    (typeof props["label"] === "string" ? props["label"] : null) ??
    (typeof props["value"] === "string" ? props["value"] : null) ??
    null

  return {
    id: typeof raw["id"] === "string" ? raw["id"] : "",
    type: typeof raw["type"] === "string" ? raw["type"] : "",
    props,
    children: childrenRaw.map(wireNodeToElement),
    text,
  }
}

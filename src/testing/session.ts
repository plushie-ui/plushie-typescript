/**
 * Test session: a Runtime connected to a pooled mock renderer.
 *
 * Provides the API for interacting with an app in tests: click,
 * typeText, find, model, assertText, etc.
 *
 * @module
 */

import * as fs from "node:fs"
import * as path from "node:path"
import type { DeepReadonly, Event, TimerEvent, AsyncEvent } from "../types.js"
import type { AppConfig } from "../app.js"
import type { WireNode } from "../tree/normalize.js"
import { Runtime } from "../runtime.js"
import { SessionPool, PooledTransport } from "../client/pool.js"
import type { WireFormat } from "../client/transport.js"
import {
  encodeQuery, encodeInteract,
  encodeTreeHash, encodeScreenshot,
  decodeMessage,
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
  private readonly config: AppConfig<M>
  private requestCounter = 0

  constructor(
    config: AppConfig<M>,
    pool: SessionPool,
    sessionId: string,
    format: WireFormat,
  ) {
    this.pool = pool
    this.sessionId = sessionId
    this.config = config
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

  /** Scroll a widget by delta amounts. */
  async scroll(selector: string, deltaX: number, deltaY: number): Promise<void> {
    await this.interact("scroll", { by: "id", value: selector }, { delta_x: deltaX, delta_y: deltaY })
  }

  /** Paste text into a widget. */
  async paste(selector: string, text: string): Promise<void> {
    await this.interact("paste", { by: "id", value: selector }, { text })
  }

  /** Sort a table column. */
  async sort(selector: string, column: string): Promise<void> {
    await this.interact("sort", { by: "id", value: selector }, { column })
  }

  /** Press on a canvas at coordinates. */
  async canvasPress(selector: string, x: number, y: number): Promise<void> {
    await this.interact("canvas_press", { by: "id", value: selector }, { x, y })
  }

  /** Release on a canvas at coordinates. */
  async canvasRelease(selector: string, x: number, y: number): Promise<void> {
    await this.interact("canvas_release", { by: "id", value: selector }, { x, y })
  }

  /** Move on a canvas to coordinates. */
  async canvasMove(selector: string, x: number, y: number): Promise<void> {
    await this.interact("canvas_move", { by: "id", value: selector }, { x, y })
  }

  /** Cycle focus within a pane grid. */
  async paneFocusCycle(selector: string): Promise<void> {
    await this.interact("pane_focus_cycle", { by: "id", value: selector }, {})
  }

  // =======================================================================
  // Utilities
  // =======================================================================

  /** Simulate a timer event by injecting a TimerEvent into the runtime. */
  timer(tag: string): void {
    const event: TimerEvent = {
      kind: "timer",
      tag,
      timestamp: Date.now(),
    }
    this.runtime.injectEvent(event)
  }

  /**
   * Wait for the next AsyncEvent with a matching tag.
   * Resolves when the event arrives or rejects on timeout.
   */
  awaitAsync(tag: string, timeout = 5000): Promise<AsyncEvent> {
    return new Promise<AsyncEvent>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`awaitAsync: timed out waiting for async event with tag "${tag}"`))
      }, timeout)

      const originalHandler = this.getMessageHandler()

      this.pool.onSessionMessage(this.sessionId, (raw) => {
        const decoded = decodeMessage(raw)
        if (decoded?.type === "event") {
          const event = decoded.data
          if (event.kind === "async" && event.tag === tag) {
            clearTimeout(timer)
            this.pool.onSessionMessage(this.sessionId, originalHandler ?? (() => {}))
            // Still dispatch the event through the runtime
            originalHandler?.(raw)
            resolve(event as AsyncEvent)
            return
          }
        }
        originalHandler?.(raw)
      })
    })
  }

  /** Re-initialize the app (call init again, re-render with snapshot). */
  reset(): void {
    this.runtime.reinit()
  }

  // =======================================================================
  // Golden file testing
  // =======================================================================

  /** Send a tree hash request and return the hash string. */
  async treeHash(name: string): Promise<string> {
    const id = this.nextId()
    const msg = encodeTreeHash(this.sessionId, id, name)

    return new Promise<string>((resolve) => {
      const originalHandler = this.getMessageHandler()

      this.pool.onSessionMessage(this.sessionId, (raw) => {
        const decoded = decodeMessage(raw)
        if (decoded?.type === "tree_hash_response" && decoded.id === id) {
          this.pool.onSessionMessage(this.sessionId, originalHandler ?? (() => {}))
          resolve(decoded.hash)
        } else {
          originalHandler?.(raw)
        }
      })

      this.pool.sendToSession(this.sessionId, msg)
    })
  }

  /** Send a screenshot request and return the screenshot data. */
  async screenshot(
    name: string,
    opts?: { width?: number; height?: number },
  ): Promise<{ hash: string; width: number; height: number; rgba: unknown }> {
    const id = this.nextId()
    const msg = encodeScreenshot(this.sessionId, id, name, opts?.width, opts?.height)

    return new Promise((resolve) => {
      const originalHandler = this.getMessageHandler()

      this.pool.onSessionMessage(this.sessionId, (raw) => {
        const decoded = decodeMessage(raw)
        if (decoded?.type === "screenshot_response" && decoded.id === id) {
          this.pool.onSessionMessage(this.sessionId, originalHandler ?? (() => {}))
          resolve({
            hash: decoded.hash,
            width: decoded.width,
            height: decoded.height,
            rgba: decoded.rgba,
          })
        } else {
          originalHandler?.(raw)
        }
      })

      this.pool.sendToSession(this.sessionId, msg)
    })
  }

  /**
   * Assert that a tree hash matches a saved golden file.
   * On first run, saves the hash. On subsequent runs, compares.
   */
  async assertTreeHash(name: string): Promise<void> {
    const hash = await this.treeHash(name)
    const goldenDir = path.resolve("test", "golden")
    const goldenPath = path.join(goldenDir, "tree_hashes.json")

    let hashes: Record<string, string> = {}
    if (fs.existsSync(goldenPath)) {
      hashes = JSON.parse(fs.readFileSync(goldenPath, "utf-8")) as Record<string, string>
    }

    if (name in hashes) {
      if (hashes[name] !== hash) {
        throw new Error(
          `assertTreeHash: hash mismatch for "${name}"\n` +
          `  expected: ${hashes[name]}\n` +
          `  actual:   ${hash}`,
        )
      }
    } else {
      hashes[name] = hash
      fs.mkdirSync(goldenDir, { recursive: true })
      fs.writeFileSync(goldenPath, JSON.stringify(hashes, null, 2) + "\n", "utf-8")
    }
  }

  /**
   * Assert that a screenshot matches a saved golden file.
   * On first run, saves the screenshot. On subsequent runs, compares the hash.
   */
  async assertScreenshot(name: string): Promise<void> {
    const result = await this.screenshot(name)
    const screenshotDir = path.resolve("test", "screenshots")
    const metaPath = path.join(screenshotDir, `${name}.json`)

    if (fs.existsSync(metaPath)) {
      const saved = JSON.parse(fs.readFileSync(metaPath, "utf-8")) as { hash: string }
      if (saved.hash !== result.hash) {
        throw new Error(
          `assertScreenshot: hash mismatch for "${name}"\n` +
          `  expected: ${saved.hash}\n` +
          `  actual:   ${result.hash}`,
        )
      }
    } else {
      fs.mkdirSync(screenshotDir, { recursive: true })
      const meta = {
        hash: result.hash,
        width: result.width,
        height: result.height,
      }
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n", "utf-8")
    }
  }

  // =======================================================================
  // Tree query + screenshot persistence
  // =======================================================================

  /**
   * Query the renderer's full tree.
   * Returns the tree as the renderer sees it, which may differ
   * from the local tree() if patches haven't been fully applied.
   */
  async queryTree(): Promise<Element | null> {
    const id = this.nextId()
    const msg = encodeQuery(this.sessionId, id, "tree", {})

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

  /**
   * Save a screenshot as raw RGBA data with a JSON metadata sidecar.
   * Captures the current rendered state and writes files to test/screenshots/.
   */
  async saveScreenshot(name: string, opts?: { width?: number; height?: number }): Promise<void> {
    const result = await this.screenshot(name, opts)
    if (result.rgba === null || result.rgba === undefined) return // mock mode stub

    const screenshotDir = path.resolve("test", "screenshots")
    fs.mkdirSync(screenshotDir, { recursive: true })

    // Write raw RGBA data
    const filePath = path.join(screenshotDir, `${name}.rgba`)
    if (result.rgba instanceof Uint8Array || Buffer.isBuffer(result.rgba)) {
      fs.writeFileSync(filePath, result.rgba as Buffer)
    }

    // Write metadata sidecar
    const metaPath = path.join(screenshotDir, `${name}.json`)
    fs.writeFileSync(metaPath, JSON.stringify({
      hash: result.hash,
      width: result.width,
      height: result.height,
    }, null, 2) + "\n", "utf-8")
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
    return this.pool.getSessionHandler(this.sessionId)
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

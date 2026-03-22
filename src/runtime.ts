/**
 * The core runtime: Elm-style update loop.
 *
 * Manages the application lifecycle:
 * 1. Connect to renderer (transport + session)
 * 2. Initialize model + first render (snapshot)
 * 3. Event loop: receive event -> dispatch -> update state -> re-render -> patch
 *
 * Event dispatch order:
 * - Widget events: check handler map first, then fall through to update()
 * - All other events: always go to update()
 *
 * @module
 */

import type {
  UINode, Command, Event, Handler, UpdateResult, Subscription, WidgetEvent,
} from "./types.js"
import { COMMAND } from "./types.js"
import type { AppConfig, AppSettings } from "./app.js"
import type { Transport } from "./client/transport.js"
import type { DecodedResponse, WireMessage } from "./client/protocol.js"
import {
  encodeSettings, encodeSnapshot, encodePatch,
  encodeSubscribe, encodeUnsubscribe, encodeWidgetOp,
  encodeWindowOp, encodeEffect, encodeImageOp,
  encodeExtensionCommand, encodeExtensionCommands,
  encodeAdvanceFrame, decodeMessage, decodeEvent,
  PROTOCOL_VERSION,
} from "./client/protocol.js"
import { normalize, type WireNode } from "./tree/normalize.js"
import { diff, type PatchOp } from "./tree/diff.js"
import { detectWindows } from "./tree/search.js"
import { drainHandlers, clearHandlers } from "./ui/handlers.js"
import type { HandlerEntry } from "./ui/handlers.js"
import * as SubscriptionMod from "./subscription.js"

// =========================================================================
// Types
// =========================================================================

/** Internal state for the runtime. */
interface RuntimeState<M> {
  model: M
  tree: WireNode | null
  handlerMap: Map<string, Map<string, Handler<unknown>>>
  subscriptionKeys: Set<string>
  windowIds: Set<string>
  asyncTasks: Map<string, { controller: AbortController; nonce: number }>
  pendingTimers: Map<string, ReturnType<typeof setTimeout>>
  pendingEffects: Map<string, ReturnType<typeof setTimeout>>
  consecutiveErrors: number
}

// =========================================================================
// Runtime
// =========================================================================

/**
 * The runtime drives the Elm update loop for a plushie app.
 *
 * It manages model state, handler dispatch, tree diffing, subscription
 * lifecycle, window sync, command execution, and error resilience.
 */
export class Runtime<M> {
  private state: RuntimeState<M>
  private readonly config: AppConfig<M>
  private readonly transport: Transport
  private readonly sessionId: string
  private started = false
  private stopped = false

  constructor(config: AppConfig<M>, transport: Transport, sessionId = "") {
    this.config = config
    this.transport = transport
    this.sessionId = sessionId
    this.state = {
      model: undefined as unknown as M,
      tree: null,
      handlerMap: new Map(),
      subscriptionKeys: new Set(),
      windowIds: new Set(),
      asyncTasks: new Map(),
      pendingTimers: new Map(),
      pendingEffects: new Map(),
      consecutiveErrors: 0,
    }
  }

  /** Current application model. */
  model(): M {
    return this.state.model
  }

  /** Current normalized wire tree. */
  tree(): WireNode | null {
    return this.state.tree
  }

  /**
   * Start the runtime: send settings, await hello, init, first render.
   */
  async start(): Promise<void> {
    if (this.started) return
    this.started = true

    // Wire up incoming messages
    this.transport.onMessage((raw) => {
      this.handleRawMessage(raw)
    })

    this.transport.onClose((reason) => {
      if (!this.stopped) {
        this.handleRendererClose(reason)
      }
    })

    // Send settings and await hello
    const settings = this.buildSettings()
    this.send(encodeSettings(this.sessionId, settings))

    // Wait for hello
    await this.awaitHello()

    // Init model
    const initResult = this.config.init
    const [model, commands] = this.unwrapResult(initResult)
    this.state.model = model

    // Freeze model in dev mode
    this.freezeModelIfDev()

    // First render (always snapshot, not diff)
    this.renderAndSync(true)

    // Execute init commands
    if (commands.length > 0) {
      this.executeCommands(commands)
    }
  }

  /** Stop the runtime and clean up. */
  stop(): void {
    this.stopped = true

    // Cancel all async tasks
    for (const [, task] of this.state.asyncTasks) {
      task.controller.abort()
    }
    this.state.asyncTasks.clear()

    // Cancel all pending timers
    for (const [, timer] of this.state.pendingTimers) {
      clearTimeout(timer)
    }
    this.state.pendingTimers.clear()

    // Cancel all effect timeouts
    for (const [, timer] of this.state.pendingEffects) {
      clearTimeout(timer)
    }
    this.state.pendingEffects.clear()

    this.transport.close()
  }

  // =======================================================================
  // Settings
  // =======================================================================

  private buildSettings(): Record<string, unknown> {
    const s = this.config.settings ?? {}
    const result: Record<string, unknown> = {}
    if (s.defaultTextSize !== undefined) result["default_text_size"] = s.defaultTextSize
    if (s.defaultFont !== undefined) result["default_font"] = s.defaultFont
    if (s.antialiasing !== undefined) result["antialiasing"] = s.antialiasing
    if (s.vsync !== undefined) result["vsync"] = s.vsync
    if (s.scaleFactor !== undefined) result["scale_factor"] = s.scaleFactor
    if (s.theme !== undefined) result["theme"] = s.theme
    if (s.fonts !== undefined) result["fonts"] = s.fonts
    if (s.defaultEventRate !== undefined) result["default_event_rate"] = s.defaultEventRate
    return result
  }

  // =======================================================================
  // Hello handshake
  // =======================================================================

  private awaitHello(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Renderer did not send hello within 10 seconds"))
      }, 10_000)

      const originalHandler = this.transport.onMessage.bind(this.transport)
      this.transport.onMessage((raw) => {
        const decoded = decodeMessage(raw)
        if (decoded?.type === "hello") {
          clearTimeout(timeout)
          if (decoded.data.protocol !== PROTOCOL_VERSION) {
            reject(new Error(
              `Protocol mismatch: renderer=${String(decoded.data.protocol)}, SDK=${String(PROTOCOL_VERSION)}`,
            ))
            return
          }
          // Restore normal message handler
          this.transport.onMessage((msg) => this.handleRawMessage(msg))
          resolve()
        }
      })
    })
  }

  // =======================================================================
  // Message handling
  // =======================================================================

  private handleRawMessage(raw: Record<string, unknown>): void {
    const decoded = decodeMessage(raw)
    if (decoded === null) return

    switch (decoded.type) {
      case "event":
        this.handleEvent(decoded.data)
        break
      case "effect_response":
        this.handleEffectResponse(decoded)
        break
      case "op_query_response":
        this.handleOpQueryResponse(decoded)
        break
      // interact_step and interact_response handled by test framework
      default:
        break
    }
  }

  // =======================================================================
  // Event dispatch
  // =======================================================================

  private handleEvent(event: Event): void {
    if (this.stopped) return

    // Widget events: check handler map first
    if (event.kind === "widget") {
      const widgetEvent = event as WidgetEvent
      const handler = this.lookupHandler(widgetEvent.id, widgetEvent.type)
      if (handler) {
        this.runUpdate(event, handler)
        return
      }
    }

    // Fall through to update()
    if (this.config.update) {
      this.runUpdate(event)
    }
  }

  private lookupHandler(widgetId: string, eventType: string): Handler<unknown> | null {
    const typeMap = this.state.handlerMap.get(widgetId)
    if (!typeMap) return null
    return typeMap.get(eventType) ?? null
  }

  // =======================================================================
  // Update cycle
  // =======================================================================

  private runUpdate(event: Event, handler?: Handler<unknown>): void {
    try {
      let result: UpdateResult<M>
      if (handler) {
        result = handler(this.state.model, event as WidgetEvent) as UpdateResult<M>
      } else if (this.config.update) {
        result = this.config.update(this.state.model as never, event) as UpdateResult<M>
      } else {
        return
      }

      // Detect accidental Promise return
      if (result != null && typeof result === "object" && "then" in result) {
        console.error(
          `Handler returned a Promise. Handlers must be synchronous.\n` +
          `Use Command.async() for async work:\n\n` +
          `  import { Command } from 'plushie'\n\n` +
          `  const fetchData = (state) => [\n` +
          `    { ...state, loading: true },\n` +
          `    Command.async(async () => fetch(url), 'result'),\n` +
          `  ]\n`,
        )
        return
      }

      const [newModel, commands] = this.unwrapResult(result)
      this.state.model = newModel
      this.state.consecutiveErrors = 0
      this.freezeModelIfDev()

      // Execute commands
      if (commands.length > 0) {
        this.executeCommands(commands)
      }

      // Re-render
      this.renderAndSync(false)
    } catch (error) {
      this.handleUpdateError(error)
    }
  }

  // =======================================================================
  // Rendering
  // =======================================================================

  private renderAndSync(forceSnapshot: boolean): void {
    try {
      clearHandlers()
      const viewResult = this.config.view(this.state.model as never)
      const tree = normalize(viewResult)

      // Extract handlers registered during view()
      const entries = drainHandlers()
      this.state.handlerMap = this.buildHandlerMap(entries)

      // Diff and send
      if (forceSnapshot || this.state.tree === null) {
        this.send(encodeSnapshot(this.sessionId, tree as unknown as WireMessage))
      } else {
        const ops = diff(this.state.tree, tree)
        if (ops.length > 0) {
          this.send(encodePatch(this.sessionId, ops as unknown as import("./client/protocol.js").WirePatchOp[]))
        }
      }

      this.state.tree = tree

      // Sync subscriptions
      this.syncSubscriptions()

      // Sync windows
      this.syncWindows(tree)
    } catch (error) {
      clearHandlers()
      this.handleUpdateError(error)
    }
  }

  // =======================================================================
  // Handler map
  // =======================================================================

  private buildHandlerMap(entries: HandlerEntry[]): Map<string, Map<string, Handler<unknown>>> {
    const map = new Map<string, Map<string, Handler<unknown>>>()
    for (const entry of entries) {
      let typeMap = map.get(entry.widgetId)
      if (!typeMap) {
        typeMap = new Map()
        map.set(entry.widgetId, typeMap)
      }
      typeMap.set(entry.eventType, entry.handler)
    }
    return map
  }

  // =======================================================================
  // Subscription lifecycle
  // =======================================================================

  private syncSubscriptions(): void {
    const subs = this.config.subscriptions
      ? this.config.subscriptions(this.state.model as never)
          .filter((s): s is Subscription => s !== false && s !== null && s !== undefined)
      : []

    const newKeys = new Map<string, Subscription>()
    for (const sub of subs) {
      newKeys.set(SubscriptionMod.key(sub), sub)
    }

    // Stop removed subscriptions
    for (const oldKey of this.state.subscriptionKeys) {
      if (!newKeys.has(oldKey)) {
        this.stopSubscription(oldKey)
      }
    }

    // Start new subscriptions
    for (const [newKey, sub] of newKeys) {
      if (!this.state.subscriptionKeys.has(newKey)) {
        this.startSubscription(newKey, sub)
      }
    }

    this.state.subscriptionKeys = new Set(newKeys.keys())
  }

  private startSubscription(key: string, sub: Subscription): void {
    if (sub.type === "every" && sub.interval !== undefined) {
      // Timer subscription: managed locally via setInterval
      const timer = setInterval(() => {
        const timerEvent: Event = {
          kind: "timer",
          tag: sub.tag,
          timestamp: Date.now(),
        }
        this.handleEvent(timerEvent)
      }, sub.interval)
      this.state.pendingTimers.set(key, timer as unknown as ReturnType<typeof setTimeout>)
    } else {
      // Renderer subscription: send subscribe message
      this.send(encodeSubscribe(this.sessionId, sub.type, sub.tag, sub.maxRate))
    }
  }

  private stopSubscription(key: string): void {
    // Check if it's a timer
    const timer = this.state.pendingTimers.get(key)
    if (timer) {
      clearInterval(timer)
      this.state.pendingTimers.delete(key)
      return
    }

    // Renderer subscription: extract kind from key
    const colonIdx = key.indexOf(":")
    if (colonIdx !== -1) {
      const kind = key.slice(0, colonIdx)
      this.send(encodeUnsubscribe(this.sessionId, kind))
    }
  }

  // =======================================================================
  // Window sync
  // =======================================================================

  private syncWindows(tree: WireNode): void {
    const newWindows = detectWindows(tree)
    const oldWindows = this.state.windowIds

    // Open new windows
    for (const id of newWindows) {
      if (!oldWindows.has(id)) {
        const props = this.extractWindowProps(tree, id)
        this.send(encodeWindowOp(this.sessionId, "open", id, props))
      }
    }

    // Close removed windows
    for (const id of oldWindows) {
      if (!newWindows.has(id)) {
        this.send(encodeWindowOp(this.sessionId, "close", id, {}))
      }
    }

    // Update surviving windows (check for prop changes)
    for (const id of newWindows) {
      if (oldWindows.has(id)) {
        const props = this.extractWindowProps(tree, id)
        if (Object.keys(props).length > 0) {
          this.send(encodeWindowOp(this.sessionId, "update", id, props))
        }
      }
    }

    this.state.windowIds = newWindows
  }

  private extractWindowProps(tree: WireNode, windowId: string): Record<string, unknown> {
    // Find the window node
    let windowNode: WireNode | null = null
    if (tree.id === windowId && tree.type === "window") {
      windowNode = tree
    } else {
      for (const child of tree.children) {
        if (child.id === windowId && child.type === "window") {
          windowNode = child
          break
        }
      }
    }
    return windowNode ? { ...windowNode.props } : {}
  }

  // =======================================================================
  // Command execution
  // =======================================================================

  private executeCommands(commands: Command[]): void {
    for (const cmd of commands) {
      this.executeCommand(cmd)
    }
  }

  private executeCommand(cmd: Command): void {
    switch (cmd.type) {
      case "none":
        break

      case "batch": {
        const nested = cmd.payload["commands"] as Command[] | undefined
        if (nested) this.executeCommands(nested)
        break
      }

      case "exit":
        this.stop()
        break

      case "async":
        this.executeAsync(cmd)
        break

      case "stream":
        this.executeStream(cmd)
        break

      case "cancel":
        this.cancelAsync(cmd.payload["tag"] as string)
        break

      case "send_after": {
        const delay = cmd.payload["delay"] as number
        const event = cmd.payload["event"] as Event
        const timer = setTimeout(() => {
          this.handleEvent(event)
        }, delay)
        this.state.pendingTimers.set(`send_after:${String(delay)}`, timer)
        break
      }

      case "focus":
      case "focus_next":
      case "focus_previous":
      case "select_all":
      case "scroll_to":
      case "scroll_by":
      case "snap_to":
      case "snap_to_end":
      case "move_cursor_to":
      case "move_cursor_to_front":
      case "move_cursor_to_end":
      case "select_range":
      case "announce":
      case "close_window":
      case "pane_split":
      case "pane_close":
      case "pane_swap":
      case "pane_maximize":
      case "pane_restore":
      case "tree_hash":
      case "find_focused":
      case "load_font":
      case "list_images":
      case "clear_images":
        this.send(encodeWidgetOp(this.sessionId, cmd.type, cmd.payload as Record<string, unknown>))
        break

      case "window_op":
        this.send(encodeWindowOp(
          this.sessionId,
          cmd.payload["op"] as string,
          cmd.payload["window_id"] as string,
          cmd.payload as Record<string, unknown>,
        ))
        break

      case "effect":
        this.executeEffect(cmd)
        break

      case "image_op":
        this.send(encodeImageOp(this.sessionId, cmd.payload["op"] as string, cmd.payload as Record<string, unknown>))
        break

      case "extension_command":
        this.send(encodeExtensionCommand(
          this.sessionId,
          cmd.payload["node_id"] as string,
          cmd.payload["op"] as string,
          (cmd.payload["payload"] as Record<string, unknown> | undefined) ?? {},
        ))
        break

      case "extension_commands":
        this.send(encodeExtensionCommands(
          this.sessionId,
          cmd.payload["commands"] as Array<{ nodeId: string; op: string; payload?: Record<string, unknown> }>,
        ))
        break

      case "advance_frame":
        this.send(encodeAdvanceFrame(this.sessionId, cmd.payload["timestamp"] as number))
        break

      default:
        // Unknown command type -- send as widget_op
        this.send(encodeWidgetOp(this.sessionId, cmd.type, cmd.payload as Record<string, unknown>))
    }
  }

  // -- Async command execution --

  private executeAsync(cmd: Command): void {
    const fn = cmd.payload["fn"] as (signal: AbortSignal) => Promise<unknown>
    const tag = cmd.payload["tag"] as string

    // Cancel existing task with same tag
    this.cancelAsync(tag)

    const controller = new AbortController()
    const nonce = Date.now()
    this.state.asyncTasks.set(tag, { controller, nonce })

    fn(controller.signal)
      .then((value) => {
        const current = this.state.asyncTasks.get(tag)
        if (!current || current.nonce !== nonce) return // stale
        this.state.asyncTasks.delete(tag)
        this.handleEvent({
          kind: "async",
          tag,
          result: { ok: true, value },
        })
      })
      .catch((error: unknown) => {
        const current = this.state.asyncTasks.get(tag)
        if (!current || current.nonce !== nonce) return // stale
        this.state.asyncTasks.delete(tag)
        this.handleEvent({
          kind: "async",
          tag,
          result: { ok: false, error },
        })
      })
  }

  private executeStream(cmd: Command): void {
    const fn = cmd.payload["fn"] as (signal: AbortSignal) => AsyncIterable<unknown>
    const tag = cmd.payload["tag"] as string

    this.cancelAsync(tag)

    const controller = new AbortController()
    const nonce = Date.now()
    this.state.asyncTasks.set(tag, { controller, nonce })

    const run = async () => {
      try {
        for await (const value of fn(controller.signal)) {
          const current = this.state.asyncTasks.get(tag)
          if (!current || current.nonce !== nonce) return
          this.handleEvent({ kind: "stream", tag, value })
        }
        const current = this.state.asyncTasks.get(tag)
        if (!current || current.nonce !== nonce) return
        this.state.asyncTasks.delete(tag)
        this.handleEvent({
          kind: "async",
          tag,
          result: { ok: true, value: undefined },
        })
      } catch (error) {
        const current = this.state.asyncTasks.get(tag)
        if (!current || current.nonce !== nonce) return
        this.state.asyncTasks.delete(tag)
        this.handleEvent({
          kind: "async",
          tag,
          result: { ok: false, error },
        })
      }
    }

    void run()
  }

  private cancelAsync(tag: string): void {
    const existing = this.state.asyncTasks.get(tag)
    if (existing) {
      existing.controller.abort()
      this.state.asyncTasks.delete(tag)
    }
  }

  // -- Effect execution --

  private executeEffect(cmd: Command): void {
    const id = cmd.payload["id"] as string
    const kind = cmd.payload["kind"] as string
    const payload = (cmd.payload["payload"] as Record<string, unknown>) ?? {}
    const timeout = (cmd.payload["timeout"] as number | undefined) ?? 30_000

    this.send(encodeEffect(this.sessionId, id, kind, payload))

    // Start timeout timer
    const timer = setTimeout(() => {
      this.state.pendingEffects.delete(id)
      this.handleEvent({
        kind: "effect",
        requestId: id,
        status: "error",
        result: null,
        error: "timeout",
      })
    }, timeout)
    this.state.pendingEffects.set(id, timer)
  }

  private handleEffectResponse(response: DecodedResponse): void {
    if (response.type !== "effect_response") return
    const id = response.id

    // Cancel timeout
    const timer = this.state.pendingEffects.get(id)
    if (timer) {
      clearTimeout(timer)
      this.state.pendingEffects.delete(id)
    }

    // Dispatch as event
    this.handleEvent({
      kind: "effect",
      requestId: id,
      status: response.status as "ok" | "cancelled" | "error",
      result: response.result,
      error: typeof response.error === "string" ? response.error : null,
    })
  }

  private handleOpQueryResponse(response: DecodedResponse): void {
    if (response.type !== "op_query_response") return
    this.handleEvent({
      kind: "system",
      type: response.kind,
      tag: response.tag,
      data: response.data,
    })
  }

  // =======================================================================
  // Error resilience
  // =======================================================================

  private handleUpdateError(error: unknown): void {
    this.state.consecutiveErrors++
    const count = this.state.consecutiveErrors

    if (count <= 10) {
      console.error(`[plushie] Error in update cycle:`, error)
    } else if (count <= 100) {
      if (count % 10 === 0) {
        console.debug(`[plushie] ${String(count)} consecutive errors (suppressing details)`)
      }
    } else if (count === 101) {
      console.warn(`[plushie] 100 consecutive errors -- suppressing further logs`)
    } else if (count % 1000 === 0) {
      console.warn(`[plushie] ${String(count)} consecutive errors`)
    }
  }

  private handleRendererClose(reason: string): void {
    console.warn(`[plushie] Renderer closed: ${reason}`)
    if (this.config.handleRendererExit) {
      try {
        this.state.model = this.config.handleRendererExit(
          this.state.model as never,
          reason,
        )
      } catch {
        // Ignore errors in exit handler
      }
    }
  }

  // =======================================================================
  // Utilities
  // =======================================================================

  private unwrapResult(result: UpdateResult<M>): [M, Command[]] {
    if (Array.isArray(result) && result.length === 2) {
      const second = result[1]
      if (second != null && typeof second === "object" && COMMAND in (second as Record<symbol, unknown>)) {
        return [result[0] as M, [second as Command]]
      }
      if (Array.isArray(second)) {
        return [result[0] as M, second as Command[]]
      }
    }
    return [result as M, []]
  }

  private freezeModelIfDev(): void {
    if (process.env["NODE_ENV"] !== "production") {
      try {
        deepFreeze(this.state.model)
      } catch {
        // Some objects can't be frozen (e.g., class instances with non-configurable props)
      }
    }
  }

  private send(msg: WireMessage): void {
    if (!this.stopped) {
      this.transport.send(msg as Record<string, unknown>)
    }
  }
}

/** Recursively freeze an object (dev mode only). */
function deepFreeze(obj: unknown): void {
  if (obj === null || typeof obj !== "object") return
  if (Object.isFrozen(obj)) return
  Object.freeze(obj)
  for (const value of Object.values(obj as Record<string, unknown>)) {
    deepFreeze(value)
  }
}

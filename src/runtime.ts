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

import type { AppConfig, AppView } from "./app.js";
import type { DecodedResponse, WireMessage, WirePatchOp } from "./client/protocol.js";
import {
  decodeMessage,
  encodeAdvanceFrame,
  encodeEffect,
  encodeExtensionCommand,
  encodeExtensionCommands,
  encodeImageOp,
  encodeInteract,
  encodePatch,
  encodeRegisterEffectStub,
  encodeSettings,
  encodeSnapshot,
  encodeSubscribe,
  encodeSystemOp,
  encodeSystemQuery,
  encodeUnregisterEffectStub,
  encodeUnsubscribe,
  encodeWidgetOp,
  encodeWindowOp,
  PROTOCOL_VERSION,
} from "./client/protocol.js";
import type { Transport } from "./client/transport.js";
import { nativeWidgetConfigKey } from "./native-widget.js";
import * as SubscriptionMod from "./subscription.js";
import { diff } from "./tree/diff.js";
import { type NormalizeContext, normalize, type WireNode } from "./tree/normalize.js";
import { detectWindows } from "./tree/search.js";
import type {
  Command,
  EffectEvent,
  Event,
  Handler,
  MouseEvent as PlushieMouseEvent,
  Subscription,
  UpdateResult,
  WidgetEvent,
} from "./types.js";
import { COMMAND } from "./types.js";
import { handlersMeta } from "./ui/handlers.js";
import {
  collectSubscriptions as collectWidgetSubscriptions,
  dispatchThroughWidgets,
  handleWidgetTimer,
  isWidgetTag,
  type RegistryEntry,
} from "./widget-handler.js";

// =========================================================================
// Types
// =========================================================================

/** A factory function that creates new Transport instances. */
export type TransportFactory = () => Transport;

/** Diagnostic event captured from the renderer. */
export interface Diagnostic {
  readonly kind: "widget";
  readonly type: "diagnostic";
  readonly id: string;
  readonly windowId: string;
  readonly scope: readonly string[];
  readonly value: string | number | boolean | null;
  readonly data: Readonly<Record<string, unknown>> | null;
}

/** Internal state for the runtime. */
interface RuntimeState<M> {
  model: M;
  tree: WireNode | null;
  handlerMap: Map<string, Map<string, Handler<unknown>>>;
  subscriptionMap: Map<string, Subscription>;
  windowIds: Set<string>;
  windowProps: Map<string, Record<string, unknown>>;
  asyncTasks: Map<string, { controller: AbortController; nonce: number }>;
  pendingTimers: Map<string, ReturnType<typeof setTimeout>>;
  pendingEffects: Map<string, ReturnType<typeof setTimeout>>;
  pendingStubAcks: Map<string, { resolve: () => void; reject: (err: Error) => void }>;
  pendingAwaitAsync: Map<string, { resolve: () => void; timer: ReturnType<typeof setTimeout> }>;
  pendingInteract: Map<
    string,
    {
      resolve: () => void;
      reject: (err: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >;
  widgetHandlerRegistry: Map<string, RegistryEntry>;
  diagnostics: Diagnostic[];
  consecutiveErrors: number;
  restartCount: number;
  coalescePending: boolean;
  pendingCoalesce: Map<string, Event>;
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
  private state: RuntimeState<M>;
  private readonly config: AppConfig<M>;
  private transport: Transport;
  private readonly transportFactory: TransportFactory | null;
  private readonly sessionId: string;
  private readonly maxRestarts = 5;
  private readonly restartBaseMs = 100;
  private readonly restartMaxMs = 5000;
  private started = false;
  private stopped = false;
  private nextNonce = 0;
  private nextInteractId = 0;

  constructor(
    config: AppConfig<M>,
    transportOrFactory: Transport | TransportFactory,
    sessionId = "",
  ) {
    this.config = config;
    this.sessionId = sessionId;
    if (typeof transportOrFactory === "function") {
      this.transportFactory = transportOrFactory;
      this.transport = transportOrFactory();
    } else {
      this.transport = transportOrFactory;
      this.transportFactory = null;
    }
    this.state = {
      model: undefined as unknown as M,
      tree: null,
      handlerMap: new Map(),
      subscriptionMap: new Map(),
      windowIds: new Set(),
      windowProps: new Map(),
      asyncTasks: new Map(),
      pendingTimers: new Map(),
      pendingEffects: new Map(),
      pendingStubAcks: new Map(),
      pendingAwaitAsync: new Map(),
      pendingInteract: new Map(),
      widgetHandlerRegistry: new Map(),
      diagnostics: [],
      consecutiveErrors: 0,
      restartCount: 0,
      coalescePending: false,
      pendingCoalesce: new Map(),
    };
  }

  /** Current application model. */
  model(): M {
    return this.state.model;
  }

  /** Current normalized wire tree. */
  tree(): WireNode | null {
    return this.state.tree;
  }

  /** Inject an external event into the update cycle. */
  injectEvent(event: Event): void {
    this.handleEvent(event);
  }

  /**
   * Returns and clears accumulated prop validation diagnostics.
   * The renderer emits diagnostic events when validate_props is enabled.
   */
  getDiagnostics(): Diagnostic[] {
    const result = this.state.diagnostics;
    this.state.diagnostics = [];
    return result;
  }

  /**
   * Register an effect stub with the renderer.
   * Sends the registration and waits for the ack round-trip.
   */
  async registerEffectStub(kind: string, response: unknown, timeout = 5000): Promise<void> {
    if (this.state.pendingStubAcks.has(kind)) {
      throw new Error(`registerEffectStub: ack already pending for "${kind}"`);
    }

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.state.pendingStubAcks.delete(kind);
        reject(new Error(`registerEffectStub: timed out waiting for ack for "${kind}"`));
      }, timeout);

      this.state.pendingStubAcks.set(kind, {
        resolve: () => {
          clearTimeout(timer);
          resolve();
        },
        reject: (err: Error) => {
          clearTimeout(timer);
          reject(err);
        },
      });

      this.send(encodeRegisterEffectStub(this.sessionId, kind, response));
    });
  }

  /**
   * Unregister an effect stub from the renderer.
   * Sends the unregistration and waits for the ack round-trip.
   */
  async unregisterEffectStub(kind: string, timeout = 5000): Promise<void> {
    if (this.state.pendingStubAcks.has(kind)) {
      throw new Error(`unregisterEffectStub: ack already pending for "${kind}"`);
    }

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.state.pendingStubAcks.delete(kind);
        reject(new Error(`unregisterEffectStub: timed out waiting for ack for "${kind}"`));
      }, timeout);

      this.state.pendingStubAcks.set(kind, {
        resolve: () => {
          clearTimeout(timer);
          resolve();
        },
        reject: (err: Error) => {
          clearTimeout(timer);
          reject(err);
        },
      });

      this.send(encodeUnregisterEffectStub(this.sessionId, kind));
    });
  }

  /**
   * Wait for an async task with the given tag to complete.
   * Resolves when the async event arrives, rejects on timeout.
   */
  awaitAsync(tag: string, timeout = 5000): Promise<void> {
    // If the task is not running, resolve immediately
    if (!this.state.asyncTasks.has(tag)) {
      return Promise.resolve();
    }

    if (this.state.pendingAwaitAsync.has(tag)) {
      return Promise.reject(new Error(`awaitAsync: already waiting for async task "${tag}"`));
    }

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.state.pendingAwaitAsync.delete(tag);
        reject(new Error(`awaitAsync: timed out waiting for async task "${tag}"`));
      }, timeout);

      this.state.pendingAwaitAsync.set(tag, { resolve, timer });
    });
  }

  /**
   * Send an interact message to the renderer and process the resulting events.
   * This is the production equivalent of TestSession.interact().
   */
  async interact(
    action: string,
    selector: { by: "id" | "text" | "role" | "label" | "focused"; value?: string },
    payload: Record<string, unknown> = {},
    timeout = 5000,
  ): Promise<void> {
    const id = `interact_${String(++this.nextInteractId)}`;
    const msg = encodeInteract(this.sessionId, id, action, selector, payload);

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.state.pendingInteract.delete(id);
        reject(new Error(`interact: timed out waiting for response to "${action}"`));
      }, timeout);

      this.state.pendingInteract.set(id, { resolve, reject, timer });
      this.send(msg);
    });
  }

  /** Re-initialize the app: reset model from init, re-render as snapshot. */
  reinit(): void {
    const [model, commands] = this.unwrapResult(this.config.init);
    this.state.model = model;
    this.freezeModelIfDev();
    this.renderAndSync(true);
    if (commands.length > 0) {
      this.executeCommands(commands);
    }
  }

  /**
   * Start the runtime: send settings, await hello, init, first render.
   */
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    // Wire up incoming messages
    this.transport.onMessage((raw) => {
      this.handleRawMessage(raw);
    });

    this.transport.onClose((reason) => {
      if (!this.stopped) {
        this.handleRendererClose(reason);
      }
    });

    // Send settings and await hello
    const settings = this.buildSettings();
    this.send(encodeSettings(this.sessionId, settings));

    // Wait for hello
    await this.awaitHello();

    // Init model
    try {
      const initResult = this.config.init;
      const [model, commands] = this.unwrapResult(initResult);
      this.state.model = model;

      // Freeze model in dev mode
      this.freezeModelIfDev();

      // First render (always snapshot, not diff)
      this.renderAndSync(true);

      // Execute init commands
      if (commands.length > 0) {
        this.executeCommands(commands);
      }
    } catch (error) {
      console.error("[plushie] Error in init:", error);
      throw error;
    }
  }

  /** Stop the runtime and clean up. */
  stop(): void {
    this.stopped = true;

    // Cancel all async tasks
    for (const [, task] of this.state.asyncTasks) {
      task.controller.abort();
    }
    this.state.asyncTasks.clear();

    // Cancel all pending timers
    for (const [, timer] of this.state.pendingTimers) {
      clearTimeout(timer);
    }
    this.state.pendingTimers.clear();

    // Cancel all effect timeouts
    for (const [, timer] of this.state.pendingEffects) {
      clearTimeout(timer);
    }
    this.state.pendingEffects.clear();

    this.transport.close();
  }

  // =======================================================================
  // Settings
  // =======================================================================

  private buildSettings(): Record<string, unknown> {
    const s = this.config.settings ?? {};
    const result: Record<string, unknown> = {};
    if (s.defaultTextSize !== undefined) result["default_text_size"] = s.defaultTextSize;
    if (s.defaultFont !== undefined) result["default_font"] = s.defaultFont;
    if (s.antialiasing !== undefined) result["antialiasing"] = s.antialiasing;
    if (s.vsync !== undefined) result["vsync"] = s.vsync;
    if (s.scaleFactor !== undefined) result["scale_factor"] = s.scaleFactor;
    if (s.theme !== undefined) result["theme"] = s.theme;
    if (s.fonts !== undefined) result["fonts"] = s.fonts;
    if (s.defaultEventRate !== undefined) result["default_event_rate"] = s.defaultEventRate;
    if (s.extensionConfig !== undefined) result["extension_config"] = s.extensionConfig;
    return result;
  }

  // =======================================================================
  // Hello handshake
  // =======================================================================

  private awaitHello(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Renderer did not send hello within 10 seconds"));
      }, 10_000);

      const _originalHandler = this.transport.onMessage.bind(this.transport);
      this.transport.onMessage((raw) => {
        const decoded = decodeMessage(raw);
        if (decoded?.type === "hello") {
          clearTimeout(timeout);
          if (decoded.data.protocol !== PROTOCOL_VERSION) {
            reject(
              new Error(
                `Protocol mismatch: renderer=${String(decoded.data.protocol)}, SDK=${String(PROTOCOL_VERSION)}`,
              ),
            );
            return;
          }

          const expectedExtensions = (this.config.expectedExtensions ?? []).map((ext) =>
            typeof ext === "string" ? ext : nativeWidgetConfigKey(ext),
          );
          const missing = expectedExtensions.filter(
            (ext) => !decoded.data.extensions.includes(ext),
          );
          if (missing.length > 0) {
            reject(
              new Error(
                `Renderer is missing required extensions ${JSON.stringify(missing)}. ` +
                  `Renderer reported ${JSON.stringify(decoded.data.extensions)}.`,
              ),
            );
            return;
          }

          // Restore normal message handler
          this.transport.onMessage((msg) => this.handleRawMessage(msg));
          resolve();
        }
      });
    });
  }

  // =======================================================================
  // Message handling
  // =======================================================================

  private handleRawMessage(raw: Record<string, unknown>): void {
    const decoded = decodeMessage(raw);
    if (decoded === null) return;

    switch (decoded.type) {
      case "event":
        this.handleEvent(decoded.data);
        break;
      case "effect_response":
        this.handleEffectResponse(decoded);
        break;
      case "op_query_response":
        this.handleOpQueryResponse(decoded);
        break;
      case "effect_stub_registered":
      case "effect_stub_unregistered":
        this.handleStubAck(decoded);
        break;
      case "interact_step":
        this.handleInteractStep(decoded);
        break;
      case "interact_response":
        this.handleInteractResponse(decoded);
        break;
      default:
        break;
    }
  }

  // =======================================================================
  // Event dispatch
  // =======================================================================

  private handleEvent(event: Event): void {
    if (this.stopped) return;

    const coalesceKey = this.isCoalescable(event);
    if (coalesceKey !== null) {
      this.state.pendingCoalesce.set(coalesceKey, event);
      if (!this.state.coalescePending) {
        this.state.coalescePending = true;
        queueMicrotask(() => this.flushCoalescables());
      }
      return;
    }

    // Non-coalescable: flush pending first to preserve ordering
    this.flushCoalescables();
    this.dispatchEvent(event);
  }

  private flushCoalescables(): void {
    this.state.coalescePending = false;
    for (const [, event] of this.state.pendingCoalesce) {
      this.dispatchEvent(event);
    }
    this.state.pendingCoalesce.clear();
  }

  private dispatchEvent(event: Event): void {
    // Capture diagnostic events before dispatching
    if (event.kind === "widget" && (event as WidgetEvent).type === "diagnostic") {
      this.state.diagnostics.push(event as Diagnostic);
    }

    // Notify any pending awaitAsync watchers
    if (event.kind === "async") {
      const asyncTag = (event as import("./types.js").AsyncEvent).tag;
      const pending = this.state.pendingAwaitAsync.get(asyncTag);
      if (pending) {
        clearTimeout(pending.timer);
        this.state.pendingAwaitAsync.delete(asyncTag);
        pending.resolve();
      }
    }

    // Route timer events for widget handler subscriptions
    if (event.kind === "timer") {
      const timerTag = (event as import("./types.js").TimerEvent).tag;
      if (isWidgetTag(timerTag)) {
        const timerResult = handleWidgetTimer(
          this.state.widgetHandlerRegistry,
          timerTag,
          (event as import("./types.js").TimerEvent).timestamp,
        );
        if (timerResult) {
          this.state.widgetHandlerRegistry = timerResult.registry;
          if (timerResult.event) {
            // Re-dispatch the emitted event
            this.dispatchEvent(timerResult.event);
          } else {
            // Widget handled internally -- re-render for state changes
            this.renderAndSync(false);
          }
          return;
        }
      }
    }

    // Route through widget handler handlers before inline handlers / update
    if (this.state.widgetHandlerRegistry.size > 0) {
      const dispatchResult = dispatchThroughWidgets(this.state.widgetHandlerRegistry, event);
      this.state.widgetHandlerRegistry = dispatchResult.registry;

      if (dispatchResult.event === null) {
        // Consumed by widget handler -- re-render for state changes
        this.renderAndSync(false);
        return;
      }

      // Use the (possibly transformed) event
      event = dispatchResult.event;
    }

    // Widget events: check handler map first
    if (event.kind === "widget") {
      const widgetEvent = event as WidgetEvent;
      const handler = this.lookupHandler(widgetEvent.windowId, widgetEvent.id, widgetEvent.type);
      if (handler) {
        this.runUpdate(event, handler);
        return;
      }
    }

    // Fall through to update()
    if (this.config.update) {
      this.runUpdate(event);
    }
  }

  private isCoalescable(event: Event): string | null {
    if (event.kind === "mouse" && (event as PlushieMouseEvent).type === "moved")
      return "mouse:moved";
    if (event.kind === "widget") {
      const we = event as WidgetEvent;
      switch (we.type) {
        case "sensor_resize":
        case "canvas_move":
        case "mouse_move":
        case "mouse_scroll":
        case "pane_resized": {
          // Use the full scoped path (scope reversed + id) so widgets with the
          // same local id in different scopes don't collide. Example: form/sensor
          // and sidebar/sensor both have id "sensor" but must coalesce separately.
          const fullId =
            we.scope.length === 0 ? we.id : [...we.scope].reverse().join("/") + "/" + we.id;
          return `${we.type}\0${we.windowId}\0${fullId}`;
        }
      }
    }
    return null;
  }

  private lookupHandler(
    windowId: string,
    widgetId: string,
    eventType: string,
  ): Handler<unknown> | null {
    const typeMap = this.state.handlerMap.get(this.handlerKey(windowId, widgetId));
    if (!typeMap) return null;
    return typeMap.get(eventType) ?? null;
  }

  // =======================================================================
  // Update cycle
  // =======================================================================

  private runUpdate(event: Event, handler?: Handler<unknown>): void {
    try {
      let result: UpdateResult<M>;
      if (handler) {
        result = handler(this.state.model, event as WidgetEvent) as UpdateResult<M>;
      } else if (this.config.update) {
        result = this.config.update(this.state.model as never, event) as UpdateResult<M>;
      } else {
        return;
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
        );
        return;
      }

      const [newModel, commands] = this.unwrapResult(result);
      this.state.model = newModel;
      this.state.consecutiveErrors = 0;
      this.freezeModelIfDev();

      // Execute commands
      if (commands.length > 0) {
        this.executeCommands(commands);
      }

      // Re-render
      this.renderAndSync(false);
    } catch (error) {
      this.handleUpdateError(error);
    }
  }

  // =======================================================================
  // Rendering
  // =======================================================================

  private renderAndSync(forceSnapshot: boolean): void {
    try {
      const viewResult = this.config.view(this.state.model as never);
      this.validateRootWindows(viewResult);

      // Build normalization context with widget handler registry
      const newEntries = new Map<string, RegistryEntry>();
      const normalizeCtx: NormalizeContext = {
        registry: this.state.widgetHandlerRegistry,
        newEntries,
      };
      const tree = normalize(viewResult, normalizeCtx);

      // Update widget handler registry from normalization results
      if (newEntries.size > 0) {
        this.state.widgetHandlerRegistry = newEntries;
      } else {
        // No widget handlers in this tree -- clear registry
        this.state.widgetHandlerRegistry = new Map();
      }

      // Extract handlers registered during view()
      this.state.handlerMap = this.buildHandlerMap(viewResult);

      // Diff and send
      if (forceSnapshot || this.state.tree === null) {
        this.send(encodeSnapshot(this.sessionId, tree as unknown as WireMessage));
      } else {
        const ops = diff(this.state.tree, tree);
        if (ops.length > 0) {
          this.send(encodePatch(this.sessionId, ops as unknown as WirePatchOp[]));
        }
      }

      this.state.tree = tree;

      // Sync subscriptions
      this.syncSubscriptions();

      // Sync windows
      this.syncWindows(tree);
    } catch (error) {
      this.handleUpdateError(error);
    }
  }

  // =======================================================================
  // Handler map
  // =======================================================================

  private buildHandlerMap(view: AppView): Map<string, Map<string, Handler<unknown>>> {
    const map = new Map<string, Map<string, Handler<unknown>>>();
    if (view === null) return map;
    if (Array.isArray(view)) {
      for (const node of view) {
        this.collectHandlers(node, map, undefined, node.id);
      }
      return map;
    }
    const node = view as import("./app.js").WindowNode;
    this.collectHandlers(node, map, undefined, node.id);
    return map;
  }

  private collectHandlers(
    node: import("./types.js").UINode,
    map: Map<string, Map<string, Handler<unknown>>>,
    scope: string | undefined,
    windowId: string | undefined,
  ): void {
    const currentWindowId = node.type === "window" ? node.id : windowId;
    const currentId =
      scope !== undefined && !node.id.startsWith("auto:") ? `${scope}/${node.id}` : node.id;
    const childScope = node.type === "window" || node.id.startsWith("auto:") ? scope : currentId;
    const nodeHandlers = handlersMeta(node.meta);

    if (nodeHandlers && currentWindowId) {
      const key = this.handlerKey(currentWindowId, currentId);
      let typeMap = map.get(key);
      if (!typeMap) {
        typeMap = new Map();
        map.set(key, typeMap);
      }

      for (const [eventType, handler] of Object.entries(nodeHandlers)) {
        typeMap.set(eventType, handler);
      }
    }

    for (const child of node.children) {
      this.collectHandlers(child, map, childScope, currentWindowId);
    }
  }

  private handlerKey(windowId: string, widgetId: string): string {
    return `${windowId}\u0000${widgetId}`;
  }

  private validateRootWindows(viewResult: AppView): void {
    if (viewResult === null) return;

    if (Array.isArray(viewResult)) {
      for (const node of viewResult) {
        if (node.type !== "window") {
          throw new Error(
            `view() must return a window node or a list of window nodes at the top level, got "${node.type}"`,
          );
        }
      }
      return;
    }

    const node = viewResult as import("./app.js").WindowNode;
    if (node.type !== "window") {
      throw new Error(
        `view() must return a window node or a list of window nodes at the top level, got "${node.type}"`,
      );
    }
  }

  // =======================================================================
  // Subscription lifecycle
  // =======================================================================

  private syncSubscriptions(): void {
    const appSubs = this.config.subscriptions
      ? this.config
          .subscriptions(this.state.model as never)
          .filter((s): s is Subscription => s !== false && s !== null && s !== undefined)
      : [];

    // Merge widget handler subscriptions
    const widgetSubs = collectWidgetSubscriptions(this.state.widgetHandlerRegistry);
    const subs = widgetSubs.length > 0 ? [...appSubs, ...widgetSubs] : appSubs;

    const newKeys = new Map<string, Subscription>();
    for (const sub of subs) {
      newKeys.set(SubscriptionMod.key(sub), sub);
    }

    // Stop removed subscriptions
    for (const [oldKey, oldSub] of this.state.subscriptionMap) {
      if (!newKeys.has(oldKey)) {
        this.stopSubscription(oldKey, oldSub);
      }
    }

    // Start new subscriptions
    for (const [newKey, sub] of newKeys) {
      if (!this.state.subscriptionMap.has(newKey)) {
        this.startSubscription(newKey, sub);
      }
    }

    // Check for max_rate changes on surviving renderer subscriptions
    for (const [key, newSub] of newKeys) {
      const oldSub = this.state.subscriptionMap.get(key);
      if (oldSub && oldSub.maxRate !== newSub.maxRate && newSub.type !== "every") {
        this.send(
          encodeSubscribe(this.sessionId, newSub.type, newSub.tag, newSub.maxRate, newSub.windowId),
        );
      }
    }

    this.state.subscriptionMap = newKeys;
  }

  private startTimerSubscription(key: string, interval: number, tag: string): void {
    const tick = () => {
      const event: Event = { kind: "timer", tag, timestamp: Date.now() };
      this.handleEvent(event);
      // Re-arm for next tick (Elixir pattern: interval measured from end of processing)
      if (this.state.pendingTimers.has(key)) {
        this.state.pendingTimers.set(
          key,
          setTimeout(tick, interval) as ReturnType<typeof setTimeout>,
        );
      }
    };
    this.state.pendingTimers.set(key, setTimeout(tick, interval) as ReturnType<typeof setTimeout>);
  }

  private startSubscription(key: string, sub: Subscription): void {
    if (sub.type === "every" && sub.interval !== undefined) {
      this.startTimerSubscription(key, sub.interval, sub.tag);
    } else {
      // Renderer subscription: send subscribe message
      this.send(encodeSubscribe(this.sessionId, sub.type, sub.tag, sub.maxRate, sub.windowId));
    }
  }

  private stopSubscription(key: string, sub?: Subscription): void {
    // Check if it's a timer
    const timer = this.state.pendingTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.state.pendingTimers.delete(key);
      return;
    }

    // Renderer subscription: extract kind from key
    const colonIdx = key.indexOf(":");
    if (colonIdx !== -1) {
      const kind = key.slice(0, colonIdx);
      // Include tag for targeted removal when the subscription is window-scoped
      this.send(encodeUnsubscribe(this.sessionId, kind, sub?.windowId ? sub.tag : undefined));
    }
  }

  // =======================================================================
  // Window sync
  // =======================================================================

  private syncWindows(tree: WireNode): void {
    const newWindows = detectWindows(tree);
    const oldWindows = this.state.windowIds;
    const baseConfig = this.config.windowConfig
      ? this.config.windowConfig(this.state.model as never)
      : {};
    const newWindowProps = new Map<string, Record<string, unknown>>();

    // Open new windows
    for (const id of newWindows) {
      const rawProps = this.extractWindowProps(tree, id);
      const props = { ...baseConfig, ...rawProps };
      newWindowProps.set(id, props);
      if (!oldWindows.has(id)) {
        this.send(encodeWindowOp(this.sessionId, "open", id, props));
      }
    }

    // Close removed windows
    for (const id of oldWindows) {
      if (!newWindows.has(id)) {
        this.send(encodeWindowOp(this.sessionId, "close", id, {}));
      }
    }

    // Update surviving windows only if props changed
    for (const id of newWindows) {
      if (oldWindows.has(id)) {
        const props = newWindowProps.get(id)!;
        const oldProps = this.state.windowProps.get(id);
        if (!shallowEqual(props, oldProps)) {
          this.send(encodeWindowOp(this.sessionId, "update", id, props));
        }
      }
    }

    this.state.windowIds = newWindows;
    this.state.windowProps = newWindowProps;
  }

  private extractWindowProps(tree: WireNode, windowId: string): Record<string, unknown> {
    // Find the window node
    let windowNode: WireNode | null = null;
    if (tree.id === windowId && tree.type === "window") {
      windowNode = tree;
    } else {
      for (const child of tree.children) {
        if (child.id === windowId && child.type === "window") {
          windowNode = child;
          break;
        }
      }
    }
    return windowNode ? { ...windowNode.props } : {};
  }

  // =======================================================================
  // Command execution
  // =======================================================================

  private executeCommands(commands: Command[]): void {
    for (const cmd of commands) {
      this.executeCommand(cmd);
    }
  }

  private executeCommand(cmd: Command): void {
    switch (cmd.type) {
      case "none":
        break;

      case "batch": {
        const nested = cmd.payload["commands"] as Command[] | undefined;
        if (nested) this.executeCommands(nested);
        break;
      }

      case "exit":
        this.stop();
        break;

      case "async":
        this.executeAsync(cmd);
        break;

      case "stream":
        this.executeStream(cmd);
        break;

      case "cancel":
        this.cancelAsync(cmd.payload["tag"] as string);
        break;

      case "send_after": {
        const delay = cmd.payload["delay"] as number;
        const event = cmd.payload["event"] as Event;
        const timerKey = `send_after:${JSON.stringify(event)}`;
        const existing = this.state.pendingTimers.get(timerKey);
        if (existing) clearTimeout(existing);
        const timer = setTimeout(() => {
          this.state.pendingTimers.delete(timerKey);
          this.handleEvent(event);
        }, delay);
        this.state.pendingTimers.set(timerKey, timer);
        break;
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
        this.send(encodeWidgetOp(this.sessionId, cmd.type, cmd.payload as Record<string, unknown>));
        break;

      case "window_op":
        this.send(
          encodeWindowOp(
            this.sessionId,
            cmd.payload["op"] as string,
            cmd.payload["window_id"] as string,
            omitPayloadKeys(cmd.payload as Record<string, unknown>, ["op", "window_id"]),
          ),
        );
        break;

      case "window_query":
        this.send(
          encodeWindowOp(
            this.sessionId,
            cmd.payload["op"] as string,
            cmd.payload["window_id"] as string,
            omitPayloadKeys(cmd.payload as Record<string, unknown>, ["op", "window_id"]),
          ),
        );
        break;

      case "system_op":
        this.send(
          encodeSystemOp(
            this.sessionId,
            cmd.payload["op"] as string,
            omitPayloadKeys(cmd.payload as Record<string, unknown>, ["op"]),
          ),
        );
        break;

      case "system_query":
        this.send(
          encodeSystemQuery(
            this.sessionId,
            cmd.payload["op"] as string,
            omitPayloadKeys(cmd.payload as Record<string, unknown>, ["op"]),
          ),
        );
        break;

      case "done": {
        const value = cmd.payload["value"];
        const mapper = cmd.payload["mapper"] as ((v: unknown) => unknown) | undefined;
        if (mapper) {
          const mappedValue = mapper(value);
          // Defer to match Elixir's mailbox-based dispatch
          queueMicrotask(() => {
            if (this.config.update) {
              this.runUpdate(mappedValue as Event);
            }
          });
        }
        break;
      }

      case "effect":
        this.executeEffect(cmd);
        break;

      case "image_op":
        this.send(
          encodeImageOp(
            this.sessionId,
            cmd.payload["op"] as string,
            omitPayloadKeys(cmd.payload as Record<string, unknown>, ["op"]),
          ),
        );
        break;

      case "extension_command":
        this.send(
          encodeExtensionCommand(
            this.sessionId,
            cmd.payload["node_id"] as string,
            cmd.payload["op"] as string,
            (cmd.payload["payload"] as Record<string, unknown> | undefined) ?? {},
          ),
        );
        break;

      case "extension_commands":
        this.send(
          encodeExtensionCommands(
            this.sessionId,
            cmd.payload["commands"] as Array<{
              nodeId: string;
              op: string;
              payload?: Record<string, unknown>;
            }>,
          ),
        );
        break;

      case "advance_frame":
        this.send(encodeAdvanceFrame(this.sessionId, cmd.payload["timestamp"] as number));
        break;

      default:
        // Unknown command type -- send as widget_op
        this.send(encodeWidgetOp(this.sessionId, cmd.type, cmd.payload as Record<string, unknown>));
    }
  }

  // -- Async command execution --

  private executeAsync(cmd: Command): void {
    const fn = cmd.payload["fn"] as (signal: AbortSignal) => Promise<unknown>;
    const tag = cmd.payload["tag"] as string;

    // Cancel existing task with same tag
    this.cancelAsync(tag);

    const controller = new AbortController();
    const nonce = ++this.nextNonce;
    this.state.asyncTasks.set(tag, { controller, nonce });

    void fn(controller.signal)
      .then((value) => {
        const current = this.state.asyncTasks.get(tag);
        if (!current || current.nonce !== nonce) return; // stale
        this.state.asyncTasks.delete(tag);
        this.handleEvent({
          kind: "async",
          tag,
          result: { ok: true, value },
        });
      })
      .catch((error: unknown) => {
        const current = this.state.asyncTasks.get(tag);
        if (!current || current.nonce !== nonce) return; // stale
        this.state.asyncTasks.delete(tag);
        this.handleEvent({
          kind: "async",
          tag,
          result: { ok: false, error },
        });
      });
  }

  private executeStream(cmd: Command): void {
    const fn = cmd.payload["fn"] as (signal: AbortSignal) => AsyncIterable<unknown>;
    const tag = cmd.payload["tag"] as string;

    this.cancelAsync(tag);

    const controller = new AbortController();
    const nonce = ++this.nextNonce;
    this.state.asyncTasks.set(tag, { controller, nonce });

    const run = async () => {
      try {
        for await (const value of fn(controller.signal)) {
          const current = this.state.asyncTasks.get(tag);
          if (!current || current.nonce !== nonce) return;
          this.handleEvent({ kind: "stream", tag, value });
        }
        const current = this.state.asyncTasks.get(tag);
        if (!current || current.nonce !== nonce) return;
        this.state.asyncTasks.delete(tag);
        this.handleEvent({
          kind: "async",
          tag,
          result: { ok: true, value: undefined },
        });
      } catch (error) {
        const current = this.state.asyncTasks.get(tag);
        if (!current || current.nonce !== nonce) return;
        this.state.asyncTasks.delete(tag);
        this.handleEvent({
          kind: "async",
          tag,
          result: { ok: false, error },
        });
      }
    };

    void run();
  }

  private cancelAsync(tag: string): void {
    const existing = this.state.asyncTasks.get(tag);
    if (existing) {
      existing.controller.abort();
      this.state.asyncTasks.delete(tag);
    }
  }

  // -- Effect execution --

  private executeEffect(cmd: Command): void {
    const id = cmd.payload["id"] as string;
    const kind = cmd.payload["kind"] as string;
    const payload = (cmd.payload["payload"] as Record<string, unknown>) ?? {};
    const timeout = (cmd.payload["timeout"] as number | undefined) ?? 30_000;

    this.send(encodeEffect(this.sessionId, id, kind, payload));

    // Start timeout timer
    const timer = setTimeout(() => {
      this.state.pendingEffects.delete(id);
      this.handleEvent({
        kind: "effect",
        requestId: id,
        status: "error",
        result: null,
        error: "timeout",
      });
    }, timeout);
    this.state.pendingEffects.set(id, timer);
  }

  private handleEffectResponse(response: DecodedResponse): void {
    if (response.type !== "effect_response") return;
    const id = response.id;

    // Cancel timeout
    const timer = this.state.pendingEffects.get(id);
    if (timer) {
      clearTimeout(timer);
      this.state.pendingEffects.delete(id);
    }

    // Dispatch as event
    this.handleEvent({
      kind: "effect",
      requestId: id,
      status: response.status as "ok" | "cancelled" | "error",
      result: response.result,
      error: typeof response.error === "string" ? response.error : null,
    });
  }

  private handleOpQueryResponse(response: DecodedResponse): void {
    if (response.type !== "op_query_response") return;
    this.handleEvent({
      kind: "system",
      type: response.kind,
      tag: response.tag,
      data: response.data,
    });
  }

  private handleStubAck(response: DecodedResponse): void {
    if (response.type !== "effect_stub_registered" && response.type !== "effect_stub_unregistered")
      return;
    const pending = this.state.pendingStubAcks.get(response.kind);
    if (pending) {
      this.state.pendingStubAcks.delete(response.kind);
      pending.resolve();
    }
  }

  private handleInteractStep(response: DecodedResponse): void {
    if (response.type !== "interact_step") return;
    // Process events through update+commands WITHOUT rendering after each.
    // Matches Elixir's apply_event which defers view/render.
    for (const eventRaw of response.events) {
      const eventDecoded = decodeMessage(eventRaw);
      if (eventDecoded?.type === "event") {
        this.applyEvent(eventDecoded.data);
      }
    }
    // Render once and send a single snapshot (headless step protocol).
    this.renderAndSync(true);
  }

  /** Process an event through update+commands without rendering.
   * Used by interact_step to batch events before a single render. */
  private applyEvent(event: Event): void {
    // Route through widget handler handlers
    if (this.state.widgetHandlerRegistry.size > 0) {
      const result = dispatchThroughWidgets(this.state.widgetHandlerRegistry, event);
      this.state.widgetHandlerRegistry = result.registry;
      if (result.event === null) return; // consumed
      event = result.event;
    }

    try {
      // Check inline handler first
      if ("id" in event && "type" in event) {
        const widgetEvent = event as WidgetEvent;
        const handler = this.lookupHandler(widgetEvent.windowId, widgetEvent.id, widgetEvent.type);
        if (handler) {
          const result = handler(this.state.model, widgetEvent) as UpdateResult<M>;
          const [newModel, commands] = this.unwrapResult(result);
          this.state.model = newModel;
          this.executeCommands(commands);
          return;
        }
      }
      // Fall through to update
      if (this.config.update) {
        const result = this.config.update(this.state.model as never, event) as UpdateResult<M>;
        const [newModel, commands] = this.unwrapResult(result);
        this.state.model = newModel;
        this.executeCommands(commands);
      }
    } catch (error) {
      this.handleUpdateError(error);
    }
  }

  private handleInteractResponse(response: DecodedResponse): void {
    if (response.type !== "interact_response") return;
    // Process events from the response
    for (const eventRaw of response.events) {
      const eventDecoded = decodeMessage(eventRaw);
      if (eventDecoded?.type === "event") {
        this.handleEvent(eventDecoded.data);
      }
    }
    // Resolve the pending interact promise
    const id = response.id;
    const pending = this.state.pendingInteract.get(id);
    if (pending) {
      clearTimeout(pending.timer);
      this.state.pendingInteract.delete(id);
      pending.resolve();
    }
  }

  // =======================================================================
  // Error resilience
  // =======================================================================

  private handleUpdateError(error: unknown): void {
    this.state.consecutiveErrors++;
    const count = this.state.consecutiveErrors;

    if (count <= 10) {
      console.error(`[plushie] Error in update cycle:`, error);
    } else if (count <= 100) {
      if (count % 10 === 0) {
        console.debug(`[plushie] ${String(count)} consecutive errors (suppressing details)`);
      }
    } else if (count === 101) {
      console.warn(`[plushie] 100 consecutive errors -- suppressing further logs`);
    } else if (count % 1000 === 0) {
      console.warn(`[plushie] ${String(count)} consecutive errors`);
    }
  }

  private handleRendererClose(reason: string): void {
    console.warn(`[plushie] Renderer closed: ${reason}`);

    // Fail pending interact calls -- they will never get a response
    for (const [id, pending] of this.state.pendingInteract) {
      clearTimeout(pending.timer);
      pending.reject(new Error(`Interact "${id}" failed: renderer closed (${reason})`));
    }
    this.state.pendingInteract.clear();

    // Fail pending stub acks
    for (const [kind, pending] of this.state.pendingStubAcks) {
      pending.reject(new Error(`Effect stub "${kind}" failed: renderer closed (${reason})`));
    }
    this.state.pendingStubAcks.clear();

    // Resolve pending awaitAsync calls. The async tasks run in Node.js (not the
    // renderer) and may still complete, but we clear the map so the resolve
    // callback won't fire again when the async event arrives post-restart.
    for (const [, pending] of this.state.pendingAwaitAsync) {
      clearTimeout(pending.timer);
      pending.resolve();
    }
    this.state.pendingAwaitAsync.clear();

    // Flush pending effects with error events
    for (const [id, timer] of this.state.pendingEffects) {
      clearTimeout(timer);
      this.dispatchEvent({
        kind: "effect",
        requestId: id,
        status: "error",
        result: null,
        error: "renderer_restarted",
      } as EffectEvent);
    }
    this.state.pendingEffects.clear();

    if (this.config.handleRendererExit) {
      try {
        this.state.model = this.config.handleRendererExit(this.state.model as never, reason);
      } catch {
        // Ignore errors in exit handler
      }
    }

    // Attempt restart if we have a factory and haven't exhausted retries
    if (this.transportFactory && this.state.restartCount < this.maxRestarts) {
      this.scheduleRestart();
    }
  }

  private scheduleRestart(): void {
    const delay = Math.min(this.restartBaseMs * 2 ** this.state.restartCount, this.restartMaxMs);
    this.state.restartCount++;

    console.warn(
      `[plushie] Restarting renderer in ${String(delay)}ms ` +
        `(attempt ${String(this.state.restartCount)}/${String(this.maxRestarts)})`,
    );

    setTimeout(() => {
      void (async () => {
        try {
          this.transport = this.transportFactory!();
          this.transport.onMessage((raw) => this.handleRawMessage(raw));
          this.transport.onClose((r) => {
            if (!this.stopped) this.handleRendererClose(r);
          });

          // Re-send settings and await hello
          const settings = this.buildSettings();
          this.send(encodeSettings(this.sessionId, settings));
          await this.awaitHello();

          // Re-send full snapshot (force by clearing previous tree)
          this.state.tree = null;
          this.renderAndSync(true);

          // Re-sync subscriptions by resetting tracked keys so all are re-sent
          this.state.subscriptionMap = new Map();
          this.syncSubscriptions();

          // Reset restart counter on success
          this.state.restartCount = 0;
          console.info("[plushie] Renderer restarted successfully");
        } catch (err) {
          console.error("[plushie] Restart failed:", err);
          if (this.state.restartCount < this.maxRestarts) {
            this.scheduleRestart();
          }
        }
      })();
    }, delay);
  }

  // =======================================================================
  // Utilities
  // =======================================================================

  private unwrapResult(result: UpdateResult<M>): [M, Command[]] {
    if (Array.isArray(result) && result.length === 2) {
      const second = result[1];
      if (
        second != null &&
        typeof second === "object" &&
        COMMAND in (second as Record<symbol, unknown>)
      ) {
        return [result[0] as M, [second as Command]];
      }
      if (Array.isArray(second)) {
        return [result[0] as M, second as Command[]];
      }
    }
    return [result as M, []];
  }

  private freezeModelIfDev(): void {
    if (process.env["NODE_ENV"] !== "production") {
      try {
        deepFreeze(this.state.model);
      } catch {
        // Some objects can't be frozen (e.g., class instances with non-configurable props)
      }
    }
  }

  private send(msg: WireMessage): void {
    if (!this.stopped) {
      this.transport.send(msg as Record<string, unknown>);
    }
  }
}

function omitPayloadKeys(
  payload: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> {
  const result = { ...payload };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

/** Recursively freeze an object (dev mode only). */
function deepFreeze(obj: unknown): void {
  if (obj === null || typeof obj !== "object") return;
  if (Object.isFrozen(obj)) return;
  Object.freeze(obj);
  for (const value of Object.values(obj as Record<string, unknown>)) {
    deepFreeze(value);
  }
}

/** Shallow comparison of two records. */
function shallowEqual(
  a: Record<string, unknown> | undefined,
  b: Record<string, unknown> | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

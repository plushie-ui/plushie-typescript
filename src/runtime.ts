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
import type {
  DecodedResponse,
  DiagnosticMessage,
  WireMessage,
  WirePatchOp,
} from "./client/protocol.js";
import {
  decodeMessage,
  encodeAdvanceFrame,
  encodeCommand,
  encodeCommands,
  encodeEffect,
  encodeImageOp,
  encodeInteract,
  encodeLoadFont,
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
import {
  type DevOverlay,
  dismissMs,
  frozenThreshold,
  handleOverlayAction,
  maybeInjectOverlay,
  overlayAction,
  overlayEventId,
} from "./dev-overlay.js";
import { resetMemoCounter } from "./memo.js";
import { nativeWidgetConfigKey } from "./native-widget.js";
import * as SubscriptionMod from "./subscription.js";
import { diff } from "./tree/diff.js";
import {
  type MemoCache,
  type NormalizeContext,
  normalize,
  type WidgetViewCache,
  type WireNode,
} from "./tree/normalize.js";
import { detectWindows } from "./tree/search.js";
import type {
  Command,
  EffectEvent,
  Event,
  Handler,
  RendererExit,
  Subscription,
  SystemEvent,
  UpdateResult,
  WidgetEvent,
} from "./types.js";
import { COMMAND, decodeEffectResult } from "./types.js";
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

/**
 * Widget prop validation event captured from the renderer.
 *
 * Surfaced as a widget event with `type: "diagnostic"` carrying the
 * canvas a11y / prop validation payload. Distinct from the top-level
 * structured {@link Diagnostic} delivered through the diagnostic
 * channel.
 */
export interface PropValidationDiagnostic {
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
  pendingTimers: Map<string, { timer: ReturnType<typeof setTimeout>; nonce: number }>;
  pendingEffects: Map<string, { tag: string; kind: string; timer: ReturnType<typeof setTimeout> }>;
  pendingStubAcks: Map<
    string,
    {
      op: "register" | "unregister";
      resolve: () => void;
      reject: (err: Error) => void;
    }
  >;
  activeEffectStubs: Set<string>;
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
  diagnostics: PropValidationDiagnostic[];
  consecutiveErrors: number;
  restartCount: number;
  coalescePending: boolean;
  pendingCoalesce: Map<string, Event>;
  widgetStatuses: Map<string, string>;
  focusedWidgetId: string | null;
  memoCache: MemoCache;
  widgetViewCache: WidgetViewCache;
  devOverlay: DevOverlay | null;
  devOverlayTimer: ReturnType<typeof setTimeout> | null;
  consecutiveViewErrors: number;
  /**
   * Current `Command.dispatch` chain depth. Fresh entry points
   * (renderer events, async completions, timer ticks) reset this to
   * zero; each dispatch follow-up bumps it by one. Past
   * {@link DISPATCH_DEPTH_LIMIT} the runtime drops the follow-up and
   * surfaces a typed `DispatchLoopExceeded` diagnostic.
   */
  dispatchDepth: number;
}

/**
 * Maximum synchronous `Command.dispatch` chain depth before the
 * runtime guard fires.
 *
 * `Command.dispatch` schedules a follow-up via `queueMicrotask`; a
 * pathological `update` that keeps returning another dispatch would
 * pump the microtask queue indefinitely and starve the event loop.
 * Past this cap, the runtime drops the command and surfaces a typed
 * `DispatchLoopExceeded` diagnostic so the loop is visible.
 */
export const DISPATCH_DEPTH_LIMIT = 100;

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
  private readonly heartbeatIntervalMs: number | null;
  private heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  private started = false;
  private stopped = false;
  private restarting = false;
  private nextNonce = 0;
  private nextInteractId = 0;

  constructor(
    config: AppConfig<M>,
    transportOrFactory: Transport | TransportFactory,
    sessionId = "",
    opts?: { readonly heartbeatInterval?: number | null },
  ) {
    this.config = config;
    this.sessionId = sessionId;
    this.heartbeatIntervalMs = opts?.heartbeatInterval ?? 30_000;
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
      activeEffectStubs: new Set(),
      pendingAwaitAsync: new Map(),
      pendingInteract: new Map(),
      widgetHandlerRegistry: new Map(),
      diagnostics: [],
      consecutiveErrors: 0,
      restartCount: 0,
      coalescePending: false,
      pendingCoalesce: new Map(),
      widgetStatuses: new Map(),
      focusedWidgetId: null,
      memoCache: new Map(),
      widgetViewCache: new Map(),
      devOverlay: null,
      devOverlayTimer: null,
      consecutiveViewErrors: 0,
      dispatchDepth: 0,
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

  /** The full scoped ID of the currently focused widget, or null. */
  focusedWidgetId(): string | null {
    return this.state.focusedWidgetId;
  }

  /** Inject an external event into the update cycle. */
  injectEvent(event: Event): void {
    this.handleEvent(event);
  }

  /**
   * Returns and clears accumulated prop validation diagnostics.
   * The renderer emits diagnostic events when validate_props is enabled.
   */
  getDiagnostics(): PropValidationDiagnostic[] {
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
        op: "register",
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
        op: "unregister",
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
    this.resetEffectStubsForReinit();
    this.state.consecutiveErrors = 0;
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

    // Start heartbeat watchdog
    this.resetHeartbeat();

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
    for (const [, entry] of this.state.pendingTimers) {
      clearTimeout(entry.timer);
    }
    this.state.pendingTimers.clear();

    // Cancel all effect timeouts
    for (const [, pending] of this.state.pendingEffects) {
      clearTimeout(pending.timer);
    }
    this.state.pendingEffects.clear();

    this.cancelHeartbeat();
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
    if (s.nativeWidgetConfig !== undefined) result["extension_config"] = s.nativeWidgetConfig;
    if (s.validateProps !== undefined) result["validate_props"] = s.validateProps;
    // Surface required_widgets to the renderer's widget registry. The
    // renderer validates against its registered widgets and emits a
    // `required_widgets_missing` diagnostic on mismatch. The SDK does
    // not pre-check against `hello.extensions` because the renderer is
    // the source of truth.
    const required = (this.config.requiredWidgets ?? []).map((ext) =>
      typeof ext === "string" ? ext : nativeWidgetConfigKey(ext),
    );
    if (required.length > 0) result["required_widgets"] = required;
    return result;
  }

  // =======================================================================
  // Hello handshake
  // =======================================================================

  private awaitHello(): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const restoreMessageHandler = (): void => {
        this.transport.onMessage((msg) => this.handleRawMessage(msg));
      };
      const finishReject = (error: Error): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        restoreMessageHandler();
        reject(error);
      };
      const finishResolve = (): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        restoreMessageHandler();
        resolve();
      };
      const timeout = setTimeout(() => {
        finishReject(new Error("Renderer did not send hello within 10 seconds"));
      }, 10_000);

      this.transport.onMessage((raw) => {
        try {
          const decoded = decodeMessage(raw);
          if (decoded.type === "hello") {
            if (decoded.data.protocol !== PROTOCOL_VERSION) {
              finishReject(
                new Error(
                  `Protocol mismatch: renderer=${String(decoded.data.protocol)}, SDK=${String(PROTOCOL_VERSION)}`,
                ),
              );
              return;
            }

            // Missing required widgets surface as a
            // `required_widgets_missing` diagnostic emitted by the
            // renderer; the SDK does not pre-check here.
            finishResolve();
          }
        } catch (error) {
          finishReject(error instanceof Error ? error : new Error(String(error)));
        }
      });
    });
  }

  // =======================================================================
  // Message handling
  // =======================================================================

  private handleRawMessage(raw: Record<string, unknown>): void {
    const decoded = decodeMessage(raw);

    this.resetHeartbeat();

    switch (decoded.type) {
      case "event":
        this.handleEvent(decoded.data);
        break;
      case "diagnostic":
        this.handleDiagnosticMessage(decoded.data);
        break;
      case "effect_response":
        this.handleEffectResponse(decoded);
        break;
      case "op_query_response":
        this.handleOpQueryResponse(decoded);
        break;
      case "effect_stub_register_ack":
      case "effect_stub_unregister_ack":
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

  private handleDiagnosticMessage(diag: import("./client/protocol.js").DiagnosticMessage): void {
    const kind = typeof diag.diagnostic["kind"] === "string" ? diag.diagnostic["kind"] : "unknown";
    const prefix = `[plushie diagnostic: ${kind}]`;
    switch (diag.level) {
      case "error":
        console.error(prefix, diag.diagnostic);
        break;
      case "warn":
        console.warn(prefix, diag.diagnostic);
        break;
      default:
        console.info(prefix, diag.diagnostic);
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
    // Intercept status events for focus tracking and derive focused/blurred events.
    if (event.kind === "widget" && (event as WidgetEvent).type === "status") {
      this.handleStatusEvent(event as WidgetEvent);
      return;
    }

    // Capture diagnostic events before dispatching
    if (event.kind === "widget" && (event as WidgetEvent).type === "diagnostic") {
      this.state.diagnostics.push(event as PropValidationDiagnostic);
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
            // Widget handled internally; re-render for state changes
            this.renderAndSync(false);
          }
          return;
        }
      }
    }

    // Intercept dev overlay events (toggle, dismiss) before app handlers
    if (event.kind === "widget" && overlayEventId((event as WidgetEvent).id)) {
      this.handleOverlayEvent((event as WidgetEvent).id);
      return;
    }

    // Route through widget handler handlers before inline handlers / update
    if (this.state.widgetHandlerRegistry.size > 0) {
      const dispatchResult = dispatchThroughWidgets(this.state.widgetHandlerRegistry, event);
      this.state.widgetHandlerRegistry = dispatchResult.registry;

      if (dispatchResult.event === null) {
        // Consumed by widget handler; re-render for state changes
        this.renderAndSync(false);
        return;
      }

      // Use the (possibly transformed) event
      event = dispatchResult.event;
    }

    // Widget events: check handler map first
    if (event.kind === "widget") {
      const widgetEvent = event as WidgetEvent;
      const handler = this.lookupHandler(
        widgetEvent.windowId ?? "",
        widgetEvent.id,
        widgetEvent.type,
      );
      if (handler) {
        this.runUpdate(event, handler);
        return;
      }
    }

    // Fall through to update()
    this.runUpdate(event);
  }

  private handleStatusEvent(event: WidgetEvent): void {
    const status = typeof event.value === "string" ? event.value : null;
    if (!status) return;

    const scopedId =
      event.scope.length === 0 ? event.id : [...event.scope].reverse().join("/") + "/" + event.id;
    const fullId = `${event.windowId}\0${scopedId}`;
    const prevStatus = this.state.widgetStatuses.get(fullId) ?? null;
    this.state.widgetStatuses.set(fullId, status);

    if (status === "focused") {
      this.state.focusedWidgetId = fullId;
    } else if (prevStatus === "focused" && this.state.focusedWidgetId === fullId) {
      this.state.focusedWidgetId = null;
    }

    if (prevStatus !== "focused" && status === "focused") {
      this.dispatchEvent({ ...event, type: "focused", value: null, data: null });
    } else if (prevStatus === "focused" && status !== "focused") {
      this.dispatchEvent({ ...event, type: "blurred", value: null, data: null });
    }
  }

  private handleOverlayEvent(eventId: string): void {
    if (!this.state.devOverlay) return;

    const action = overlayAction(eventId);
    const result = handleOverlayAction(action, this.state.devOverlay);

    switch (result.type) {
      case "updated":
        this.state.devOverlay = result.overlay;
        if (!result.overlay.expanded && result.overlay.status === "succeeded") {
          this.scheduleOverlayDismiss();
        }
        this.renderAndSync(false);
        break;
      case "dismissed":
        this.cancelOverlayTimer();
        this.state.devOverlay = null;
        this.renderAndSync(false);
        break;
      case "noop":
        break;
    }
  }

  private scheduleOverlayDismiss(): void {
    this.cancelOverlayTimer();
    this.state.devOverlayTimer = setTimeout(() => {
      this.state.devOverlayTimer = null;
      if (this.state.devOverlay && !this.state.devOverlay.expanded) {
        this.state.devOverlay = null;
        this.renderAndSync(false);
      }
    }, dismissMs());
  }

  private cancelOverlayTimer(): void {
    if (this.state.devOverlayTimer !== null) {
      clearTimeout(this.state.devOverlayTimer);
      this.state.devOverlayTimer = null;
    }
  }

  private isCoalescable(event: Event): string | null {
    if (event.kind === "widget") {
      const we = event as WidgetEvent;
      switch (we.type) {
        case "move":
        case "scroll":
        case "resize":
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
    if (windowId !== "") {
      const typeMap = this.state.handlerMap.get(this.handlerKey(windowId, widgetId));
      if (typeMap) return typeMap.get(eventType) ?? null;
      return null;
    }
    // The renderer does not include window_id on widget events, so
    // scan every window for the first registered handler matching
    // widgetId + eventType. Handler keys are "${windowId}\u0000${widgetId}";
    // suffix-match on "\u0000${widgetId}".
    const suffix = `\u0000${widgetId}`;
    for (const [key, typeMap] of this.state.handlerMap) {
      if (key.endsWith(suffix)) {
        const handler = typeMap.get(eventType);
        if (handler) return handler;
      }
    }
    return null;
  }

  // =======================================================================
  // Update cycle
  // =======================================================================

  private runUpdate(event: Event, handler?: Handler<unknown>, depth = 0): void {
    // Set the dispatch chain position for this update so the
    // `case "done"` handler in executeCommand sees the correct
    // counter before deciding whether to schedule the follow-up.
    this.state.dispatchDepth = depth;
    try {
      const result: UpdateResult<M> = handler
        ? (handler(this.state.model, event as WidgetEvent) as UpdateResult<M>)
        : (this.config.update(this.state.model as never, event) as UpdateResult<M>);

      // Detect accidental Promise return
      if (result != null && typeof result === "object" && "then" in result) {
        console.error(
          `Handler returned a Promise. Handlers must be synchronous.\n` +
            `Use Command.task() for async work:\n\n` +
            `  import { Command } from 'plushie'\n\n` +
            `  const fetchData = (state) => [\n` +
            `    { ...state, loading: true },\n` +
            `    Command.task(async () => fetch(url), 'result'),\n` +
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
    // Save registry before view in case we need to revert on error.
    // A view error must not leave the handler registry reflecting an
    // update the tree never rendered.
    const registryBefore = this.state.widgetHandlerRegistry;
    try {
      const viewResult = this.config.view(this.state.model as never);
      this.validateRootWindows(viewResult);

      // Reset memo counter so memo() IDs are stable across renders
      resetMemoCounter();

      // Build normalization context with widget handler registry and caches
      const newEntries = new Map<string, RegistryEntry>();
      const memo = new Map<string, import("./tree/normalize.js").MemoCacheEntry>();
      const widgetView = new Map<string, import("./tree/normalize.js").WidgetViewCacheEntry>();
      const handlerMap = new Map<string, Map<string, Handler<unknown>>>();
      const normalizeCtx: NormalizeContext = {
        registry: this.state.widgetHandlerRegistry,
        newEntries,
        memoPrev: this.state.memoCache,
        memo,
        widgetViewPrev: this.state.widgetViewCache,
        widgetView,
        handlerMap,
      };
      const tree = normalize(viewResult, normalizeCtx);

      // Capture new caches
      this.state.memoCache = memo;
      this.state.widgetViewCache = widgetView;

      // Clear frozen-UI overlay on successful render
      if (this.state.devOverlay && this.state.devOverlay.status === "frozen_ui") {
        this.state.devOverlay = null;
      }
      this.state.consecutiveViewErrors = 0;

      // Inject dev overlay into tree
      const treeWithOverlay = maybeInjectOverlay(tree, this.state.devOverlay) ?? tree;

      // Update widget handler registry from normalization results
      if (newEntries.size > 0) {
        this.state.widgetHandlerRegistry = newEntries;
      } else {
        // No widget handlers in this tree; clear registry
        this.state.widgetHandlerRegistry = new Map();
      }

      this.state.handlerMap = handlerMap;

      // Diff and send
      if (forceSnapshot || this.state.tree === null) {
        this.send(encodeSnapshot(this.sessionId, treeWithOverlay as unknown as WireMessage));
      } else {
        const ops = diff(this.state.tree, treeWithOverlay);
        if (ops.length > 0) {
          this.send(encodePatch(this.sessionId, ops as unknown as WirePatchOp[]));
        }
      }

      this.state.tree = treeWithOverlay;

      // Sync subscriptions
      this.syncSubscriptions();

      // Sync windows
      this.syncWindows(tree);
    } catch (error) {
      // Revert widget handler registry to prevent state-tree desync
      this.state.widgetHandlerRegistry = registryBefore;
      this.handleUpdateError(error);

      // Track consecutive view errors and inject frozen-UI overlay
      this.state.consecutiveViewErrors++;
      if (
        this.state.consecutiveViewErrors === frozenThreshold() &&
        !this.state.devOverlay &&
        this.state.tree
      ) {
        this.state.devOverlay = { status: "frozen_ui", detail: "", expanded: false };
        const patched = maybeInjectOverlay(this.state.tree, this.state.devOverlay);
        if (patched) {
          const ops = diff(this.state.tree, patched);
          if (ops.length > 0) {
            this.send(encodePatch(this.sessionId, ops as unknown as WirePatchOp[]));
          }
          this.state.tree = patched;
        }
      }

      // Signal that the tree may be out of sync with the model
      this.dispatchDesyncEvent(error);
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
    let appSubs: Subscription[];
    if (this.config.subscriptions) {
      try {
        appSubs = this.config.subscriptions(this.state.model as never);
      } catch (error: unknown) {
        this.handleUpdateError(error);
        appSubs = [];
      }
    } else {
      appSubs = [];
    }

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
        const wireTag = SubscriptionMod.rendererWireTag(newSub);
        this.send(
          encodeSubscribe(this.sessionId, newSub.type, wireTag, newSub.maxRate, newSub.windowId),
        );
      }
    }

    this.state.subscriptionMap = newKeys;
  }

  private static timerNonce = 0;

  private startTimerSubscription(key: string, interval: number, tag: string): void {
    const tick = () => {
      const event: Event = { kind: "timer", tag: tag, timestamp: Date.now() };
      this.handleEvent(event);
      if (this.state.pendingTimers.has(key)) {
        this.state.pendingTimers.set(key, {
          timer: setTimeout(tick, interval) as ReturnType<typeof setTimeout>,
          nonce: ++Runtime.timerNonce,
        });
      }
    };
    this.state.pendingTimers.set(key, {
      timer: setTimeout(tick, interval) as ReturnType<typeof setTimeout>,
      nonce: ++Runtime.timerNonce,
    });
  }

  private startSubscription(key: string, sub: Subscription): void {
    if (sub.type === "every" && sub.interval !== undefined && sub.tag !== undefined) {
      this.startTimerSubscription(key, sub.interval, sub.tag);
    } else {
      const wireTag = SubscriptionMod.rendererWireTag(sub);
      this.send(encodeSubscribe(this.sessionId, sub.type, wireTag, sub.maxRate, sub.windowId));
    }
  }

  private stopSubscription(key: string, sub?: Subscription): void {
    // Check if it's a timer
    const entry = this.state.pendingTimers.get(key);
    if (entry) {
      clearTimeout(entry.timer);
      this.state.pendingTimers.delete(key);
      return;
    }

    // Renderer subscription: send unsubscribe with wire tag
    if (sub && sub.type !== "every") {
      const wireTag = SubscriptionMod.rendererWireTag(sub);
      this.send(encodeUnsubscribe(this.sessionId, sub.type, wireTag));
    }
  }

  // =======================================================================
  // Window sync
  // =======================================================================

  private syncWindows(tree: WireNode): void {
    const newWindows = detectWindows(tree);
    const oldWindows = this.state.windowIds;
    const baseConfig = this.config.windowConfig
      ? (() => {
          try {
            return this.config.windowConfig!(this.state.model as never);
          } catch (error: unknown) {
            this.handleUpdateError(error);
            return {};
          }
        })()
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

      case "task":
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
        if (existing) clearTimeout(existing.timer);
        const nonce = ++Runtime.timerNonce;
        const timer = setTimeout(() => {
          const current = this.state.pendingTimers.get(timerKey);
          if (current && current.nonce === nonce) {
            this.state.pendingTimers.delete(timerKey);
            this.handleEvent(event);
          }
        }, delay);
        this.state.pendingTimers.set(timerKey, { timer, nonce });
        break;
      }

      case "command": {
        const id = cmd.payload["id"] as string;
        const family = cmd.payload["family"] as string;
        const value = cmd.payload["value"];
        this.send(encodeCommand(this.sessionId, id, family, value));
        break;
      }

      case "commands": {
        const commands = cmd.payload["commands"] as Array<{
          id: string;
          family: string;
          value?: unknown;
        }>;
        this.send(encodeCommands(this.sessionId, commands));
        break;
      }

      case "widget_op":
        this.send(
          encodeWidgetOp(
            this.sessionId,
            cmd.payload["op"] as string,
            cmd.payload as Record<string, unknown>,
          ),
        );
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

      case "dispatch":
      case "done": {
        const value = cmd.payload["value"];
        const mapper = cmd.payload["mapper"] as ((v: unknown) => unknown) | undefined;
        if (mapper) {
          const nextDepth = this.state.dispatchDepth + 1;
          if (nextDepth > DISPATCH_DEPTH_LIMIT) {
            // Drop the dispatched command and surface the typed
            // diagnostic so a pathological update loop is visible
            // rather than pumping the microtask queue indefinitely.
            const diag: DiagnosticMessage = {
              session: this.sessionId,
              level: "error",
              diagnostic: {
                kind: "dispatch_loop_exceeded",
                depth: nextDepth,
                limit: DISPATCH_DEPTH_LIMIT,
              },
            };
            console.error(
              `plushie runtime: dispatch_loop_exceeded: command chain ` +
                `reached depth ${String(nextDepth)} ` +
                `(limit ${String(DISPATCH_DEPTH_LIMIT)}); ` +
                `dropping command to break the loop`,
            );
            this.handleDiagnosticMessage(diag);
            break;
          }
          let mappedValue: unknown;
          try {
            mappedValue = mapper(value);
          } catch (mapperError: unknown) {
            this.handleUpdateError(mapperError, "done mapper");
            break;
          }
          queueMicrotask(() => {
            this.runUpdate(mappedValue as Event, undefined, nextDepth);
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

      case "advance_frame":
        this.send(encodeAdvanceFrame(this.sessionId, cmd.payload["timestamp"] as number));
        break;

      case "load_font":
        this.send(
          encodeLoadFont(
            this.sessionId,
            cmd.payload["family"] as string,
            cmd.payload["data"] as Uint8Array,
            this.transport.format,
          ),
        );
        break;

      default:
        // Unknown command type; send as widget_op
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
    const tag = cmd.payload["tag"] as string;
    const kind = cmd.payload["kind"] as string;
    const payload = (cmd.payload["payload"] as Record<string, unknown>) ?? {};
    const timeout = (cmd.payload["timeout"] as number | undefined) ?? 30_000;

    // One effect per tag: cancel any existing pending effect with the same tag.
    // The response for the old wire ID will be ignored since we remove it from
    // the pending map.
    for (const [existingId, pending] of this.state.pendingEffects) {
      if (pending.tag === tag) {
        clearTimeout(pending.timer);
        this.state.pendingEffects.delete(existingId);
        break;
      }
    }

    this.send(encodeEffect(this.sessionId, id, kind, payload));

    // Start timeout timer
    const timer = setTimeout(() => {
      this.state.pendingEffects.delete(id);
      this.handleEvent({
        kind: "effect",
        tag,
        result: { kind: "timeout" },
      });
    }, timeout);
    this.state.pendingEffects.set(id, { tag, kind, timer });
  }

  private handleEffectResponse(response: DecodedResponse): void {
    if (response.type !== "effect_response") return;
    const id = response.id;

    // Look up tag and cancel timeout
    const pending = this.state.pendingEffects.get(id);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.state.pendingEffects.delete(id);

    // Decode the wire (status, result, error) triple into a typed
    // variant based on the original effect kind.
    const typedResult = decodeEffectResult(
      pending.kind,
      response.status,
      response.result,
      typeof response.error === "string" ? response.error : null,
    );

    this.handleEvent({
      kind: "effect",
      tag: pending.tag,
      result: typedResult,
    });
  }

  private handleOpQueryResponse(response: DecodedResponse): void {
    if (response.type !== "op_query_response") return;
    this.handleEvent({
      kind: "system",
      type: response.kind,
      tag: response.tag,
      value: response.data,
    });
  }

  private handleStubAck(response: DecodedResponse): void {
    if (
      response.type !== "effect_stub_register_ack" &&
      response.type !== "effect_stub_unregister_ack"
    )
      return;
    const pending = this.state.pendingStubAcks.get(response.kind);
    if (!pending) return;

    const ackOp = response.type === "effect_stub_register_ack" ? "register" : "unregister";
    if (pending.op !== ackOp) return;

    this.state.pendingStubAcks.delete(response.kind);
    if (ackOp === "register") {
      this.state.activeEffectStubs.add(response.kind);
    } else {
      this.state.activeEffectStubs.delete(response.kind);
    }
    pending.resolve();
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
        const handler = this.lookupHandler(
          widgetEvent.windowId ?? "",
          widgetEvent.id,
          widgetEvent.type,
        );
        if (handler) {
          const result = handler(this.state.model, widgetEvent) as UpdateResult<M>;
          const [newModel, commands] = this.unwrapResult(result);
          this.state.model = newModel;
          this.executeCommands(commands);
          return;
        }
      }
      // Fall through to update
      const result = this.config.update(this.state.model as never, event) as UpdateResult<M>;
      const [newModel, commands] = this.unwrapResult(result);
      this.state.model = newModel;
      this.executeCommands(commands);
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

  private handleUpdateError(error: unknown, label = "update"): void {
    this.state.consecutiveErrors++;
    const count = this.state.consecutiveErrors;

    if (count <= 10) {
      console.error(`[plushie] Error in ${label}:`, error);
    } else if (count <= 100) {
      if (count % 10 === 0) {
        console.debug(`[plushie] ${String(count)} consecutive errors (suppressing details)`);
      }
    } else if (count === 101) {
      console.warn(`[plushie] 100 consecutive errors; suppressing further logs`);
    } else if (count % 1000 === 0) {
      console.warn(`[plushie] ${String(count)} consecutive errors`);
    }
  }

  private dispatchingDesync = false;

  private dispatchDesyncEvent(error: unknown): void {
    if (this.dispatchingDesync) return;
    this.dispatchingDesync = true;
    try {
      const desyncEvent: SystemEvent = {
        kind: "system",
        type: "view_desync",
        tag: "view_desync",
        value: {
          message: error instanceof Error ? error.message : String(error),
        },
      };
      this.runUpdate(desyncEvent);
    } finally {
      this.dispatchingDesync = false;
    }
  }

  private handleRendererClose(reason: string): void {
    if (this.restarting) return;
    this.cancelHeartbeat();
    console.warn(`[plushie] Renderer closed: ${reason}`);

    // Fail pending interact calls; they will never get a response
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
    this.state.activeEffectStubs.clear();

    // Resolve pending awaitAsync calls. The async tasks run in Node.js (not the
    // renderer) and may still complete, but we clear the map so the resolve
    // callback won't fire again when the async event arrives post-restart.
    for (const [, pending] of this.state.pendingAwaitAsync) {
      clearTimeout(pending.timer);
      pending.resolve();
    }
    this.state.pendingAwaitAsync.clear();

    // Flush pending effects with error events.
    // Drain first, then dispatch, to avoid the clear() bug where events
    // added during dispatch would be wiped.
    const effectsToFlush = [...this.state.pendingEffects.values()];
    this.state.pendingEffects.clear();
    for (const pending of effectsToFlush) {
      clearTimeout(pending.timer);
      this.dispatchEvent({
        kind: "effect",
        tag: pending.tag,
        result: { kind: "renderer_restarted" },
      } as EffectEvent);
    }

    if (this.config.handleRendererExit) {
      try {
        const exitInfo = normalizeExitReason(reason);
        this.state.model = this.config.handleRendererExit(this.state.model as never, exitInfo);
      } catch (exitError: unknown) {
        const recoveryEvent: Event = {
          kind: "system",
          type: "recovery_failed",
          tag: "recovery_failed",
          value: {
            exit_reason: reason,
            error: exitError instanceof Error ? exitError.message : String(exitError),
          },
        };
        this.dispatchEvent(recoveryEvent);
      }
    }

    // Attempt restart if we have a factory and haven't exhausted retries
    if (this.transportFactory && this.state.restartCount < this.maxRestarts) {
      this.scheduleRestart();
    }
  }

  private scheduleRestart(): void {
    this.restarting = true;
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
          this.state.consecutiveErrors = 0;
          this.state.widgetStatuses.clear();
          this.state.focusedWidgetId = null;
          this.resetHeartbeat();
          this.restarting = false;
          console.info("[plushie] Renderer restarted successfully");
        } catch (err) {
          console.error("[plushie] Restart failed:", err);
          if (this.state.restartCount < this.maxRestarts) {
            this.scheduleRestart();
          } else {
            this.restarting = false;
          }
        }
      })();
    }, delay);
  }

  // =======================================================================
  // Heartbeat watchdog
  // =======================================================================

  private resetHeartbeat(): void {
    if (this.heartbeatIntervalMs === null) return;
    this.cancelHeartbeat();
    this.heartbeatTimer = setTimeout(() => {
      this.heartbeatTimer = null;
      console.warn(
        `[plushie] Renderer unresponsive (no message in ${String(this.heartbeatIntervalMs)}ms)`,
      );
      this.handleRendererClose("heartbeat_timeout");
    }, this.heartbeatIntervalMs);
  }

  private cancelHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private resetEffectStubsForReinit(): void {
    const kindsToClear = new Set<string>([
      ...this.state.activeEffectStubs,
      ...this.state.pendingStubAcks.keys(),
    ]);

    for (const [kind, pending] of this.state.pendingStubAcks) {
      pending.reject(new Error(`Effect stub "${kind}" was cleared during reinit`));
    }
    this.state.pendingStubAcks.clear();
    this.state.activeEffectStubs.clear();

    for (const kind of kindsToClear) {
      this.send(encodeUnregisterEffectStub(this.sessionId, kind));
    }
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

const KNOWN_EXIT_REASONS = new Set<string>([
  "crash",
  "connection_lost",
  "shutdown",
  "heartbeat_timeout",
]);

function normalizeExitReason(raw: string): RendererExit {
  const parts = raw.split(":");
  const exitType = parts[0]!;
  const message = parts.length > 1 ? parts.slice(1).join(":").trim() : raw;
  if (KNOWN_EXIT_REASONS.has(exitType)) {
    return { type: exitType as RendererExit["type"], message: message || raw };
  }
  return { type: "crash", message: raw };
}

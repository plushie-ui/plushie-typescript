/**
 * A node in the UI tree. Every widget builder produces this shape.
 * Sent over the wire as JSON/MessagePack to the renderer.
 */
export interface UINode {
  readonly id: string;
  readonly type: string;
  readonly props: Readonly<Record<string, unknown>>;
  readonly children: readonly UINode[];
  /**
   * Optional metadata attached to the node. Never sent over the wire
   * or included in tree diffing. Use for framework-level annotations
   * (routing data, debug info, etc.) that stay on the TypeScript side.
   */
  readonly meta?: Readonly<Record<string, unknown>> | undefined;
}

/**
 * Deep readonly utility. Makes all nested properties readonly,
 * preventing mutation of the model in update handlers and views.
 */
export type DeepReadonly<T> = T extends (infer U)[]
  ? readonly DeepReadonly<U>[]
  : T extends Map<infer K, infer V>
    ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
    : T extends Set<infer U>
      ? ReadonlySet<DeepReadonly<U>>
      : T extends object
        ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
        : T;

/** Symbol used to tag Command objects for reliable detection. */
export const COMMAND: unique symbol = Symbol.for("plushie.command");

/** A command is a pure data description of a side effect. */
export interface Command {
  readonly [COMMAND]: true;
  readonly type: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

/** A subscription spec for ongoing event sources. */
export interface Subscription {
  readonly type: string;
  readonly tag: string | undefined;
  readonly interval?: number;
  readonly maxRate?: number;
  /** Scope the subscription to a specific window. Events from other windows are filtered. */
  readonly windowId?: string | undefined;
}

/**
 * Handler function for widget events. Receives current state and
 * the event, returns new state or [state, command(s)].
 */
export type Handler<S> = (
  state: DeepReadonly<S>,
  event: WidgetEvent,
) => S | readonly [S, Command | Command[]];

/**
 * The result of an update or handler call.
 * Either a bare state, or a tuple of [state, command(s)].
 */
export type UpdateResult<S> = S | readonly [S, Command | Command[]];

// -- Event types ----------------------------------------------------------

/** Discriminant for the event union type. */
export type EventKind =
  | "widget"
  | "key"
  | "modifiers"
  | "ime"
  | "window"
  | "effect"
  | "widget_command_error"
  | "system"
  | "timer"
  | "async"
  | "stream"
  | "session_error"
  | "session_closed";

/** Base fields shared by all events. */
interface EventBase {
  readonly kind: EventKind;
}

export interface WidgetEvent extends EventBase {
  readonly kind: "widget";
  readonly type: // Standard widget events
    | "click"
    | "input"
    | "submit"
    | "toggle"
    | "select"
    | "slide"
    | "slide_release"
    | "paste"
    | "option_hovered"
    | "open"
    | "close"
    | "sort"
    | "key_binding"
    | "link_click"
    // Pointer interaction events (press/release/move/scroll on any interactive surface)
    | "press"
    | "release"
    | "move"
    | "scroll"
    | "enter"
    | "exit"
    | "double_click"
    | "resize"
    // Generic focus/drag events (canvas elements, focusable widgets)
    | "focused"
    | "blurred"
    | "drag"
    | "drag_end"
    | "key_press"
    | "key_release"
    // Widget status tracking (renderer sends status changes)
    | "status"
    // Scrollable viewport events
    | "scrolled"
    // Pane grid events
    | "pane_resized"
    | "pane_dragged"
    | "pane_clicked"
    | "pane_focus_cycle"
    // Transition animation events
    | "transition_complete"
    // Diagnostic
    | "diagnostic"
    // Allow unrecognized types from native widgets / future protocol versions.
    // The `& {}` preserves autocomplete for the literal types above; plain
    // `| string` would collapse the entire union to `string`.
    | (string & {});
  readonly id: string;
  readonly windowId: string | null;
  readonly scope: readonly string[];
  readonly value: string | number | boolean | null;
  readonly data: Readonly<Record<string, unknown>> | null;
}

// -- Typed event data interfaces ------------------------------------------
//
// These describe the `data` field shape for specific WidgetEvent types.
// Type guards in events.ts use them to narrow `data` so callers get
// typed field access without manual casts.

/** Pointer type for unified pointer events. */
export type PointerType = "mouse" | "touch" | "pen";

/** Pointer button for press/release/double_click events. */
export type PointerButton = "left" | "right" | "middle" | "back" | "forward";

/**
 * Data for pointer events (press, release, move, scroll, double_click).
 *
 * Position (`x`, `y`) is present on widget pointer events (canvas,
 * pointer_area) but absent on subscription button press/release events
 * where cursor position isn't tracked.
 */
export interface PointerData {
  /** Cursor x position. Present on widget events; absent on subscription button events. */
  readonly x?: number;
  /** Cursor y position. Present on widget events; absent on subscription button events. */
  readonly y?: number;
  readonly button?: PointerButton;
  readonly pointer?: PointerType;
  readonly finger?: number;
  readonly modifiers?: Readonly<Modifiers>;
  /** Scroll delta (horizontal). Present on scroll events. */
  readonly delta_x?: number;
  /** Scroll delta (vertical). Present on scroll events. */
  readonly delta_y?: number;
  /** Whether the event was consumed by a widget before reaching the subscription layer. */
  readonly captured?: boolean;
  /**
   * Present on touch release events when the release happened outside
   * the widget's bounds. Absent for mouse / pen releases.
   */
  readonly lost?: boolean;
  readonly [key: string]: unknown;
}

/** Data for resize events (sensor). */
export interface ResizeData {
  readonly width: number;
  readonly height: number;
  readonly [key: string]: unknown;
}

/** Data for scrolled events (scrollable viewport position). */
export interface ScrolledData {
  readonly absolute_x: number;
  readonly absolute_y: number;
  readonly relative_x: number;
  readonly relative_y: number;
  readonly [key: string]: unknown;
}

/** Data for drag events (canvas elements, draggable widgets). */
export interface DragData {
  readonly x: number;
  readonly y: number;
  readonly delta_x: number;
  readonly delta_y: number;
  readonly [key: string]: unknown;
}

/** Data for widget-scoped key_press events. */
export interface KeyPressData {
  readonly key: string;
  readonly modifiers: Readonly<Record<string, unknown>>;
  /** Text produced by the key press, or null for non-printable keys. */
  readonly text: string | null;
  readonly [key: string]: unknown;
}

/** Data for widget-scoped key_release events. */
export interface KeyReleaseData {
  readonly key: string;
  readonly modifiers: Readonly<Record<string, unknown>>;
  readonly [key: string]: unknown;
}

/** Data for link_click events emitted by rich_text and markdown widgets. */
export interface LinkClickData {
  readonly link: string;
  readonly [key: string]: unknown;
}

export interface KeyEvent extends EventBase {
  readonly kind: "key";
  readonly type: "press" | "release";
  readonly key: string;
  readonly modifiedKey: string | null;
  readonly physicalKey: string | null;
  readonly modifiers: Readonly<Modifiers>;
  readonly location: "left" | "right" | "standard";
  readonly text: string | null;
  readonly repeat: boolean;
  readonly tag: string;
  readonly captured: boolean;
  /** Window that had focus when the key event fired, or null for global events. */
  readonly windowId: string | null;
}

export interface ModifiersEvent extends EventBase {
  readonly kind: "modifiers";
  readonly modifiers: Readonly<Modifiers>;
  readonly tag: string;
  readonly captured: boolean;
  /** Window that had focus when modifiers changed, or null for global events. */
  readonly windowId: string | null;
}

export interface Modifiers {
  readonly ctrl: boolean;
  readonly shift: boolean;
  readonly alt: boolean;
  readonly logo: boolean;
  readonly command: boolean;
}

export interface ImeEvent extends EventBase {
  readonly kind: "ime";
  readonly type: "opened" | "preedit" | "commit" | "closed";
  readonly text: string | null;
  readonly cursor: readonly [number, number] | null;
  readonly tag: string;
  readonly captured: boolean;
  /** Window that had focus when the IME event fired, or null for global events. */
  readonly windowId: string | null;
}

export interface WindowEvent extends EventBase {
  readonly kind: "window";
  readonly type:
    | "opened"
    | "closed"
    | "close_requested"
    | "resized"
    | "moved"
    | "focused"
    | "unfocused"
    | "rescaled"
    | "file_hovered"
    | "file_dropped"
    | "files_hovered_left";
  readonly windowId: string;
  readonly tag: string;
  readonly data: Readonly<Record<string, unknown>> | null;
}

/**
 * Typed outcome of a platform effect.
 *
 * Each variant corresponds to either a success case for a specific
 * effect kind (FileOpened, ClipboardText, etc.) or a non-success case
 * (Cancelled, Timeout, Error, Unsupported, RendererRestarted).
 *
 * Matches the Rust SDK's EffectResult enum. Host SDKs share the
 * concept but use language-idiomatic shapes; TypeScript uses a
 * discriminated union with `kind` as the discriminator.
 */
export type EffectResult =
  | { readonly kind: "file_opened"; readonly path: string }
  | { readonly kind: "files_opened"; readonly paths: readonly string[] }
  | { readonly kind: "file_saved"; readonly path: string }
  | { readonly kind: "directory_selected"; readonly path: string }
  | { readonly kind: "directories_selected"; readonly paths: readonly string[] }
  | { readonly kind: "clipboard_text"; readonly text: string }
  | {
      readonly kind: "clipboard_html";
      readonly html: string;
      readonly altText: string | null;
    }
  | { readonly kind: "clipboard_written" }
  | { readonly kind: "clipboard_cleared" }
  | { readonly kind: "notification_shown" }
  | { readonly kind: "cancelled" }
  | { readonly kind: "timeout" }
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "unsupported" }
  | { readonly kind: "renderer_restarted" };

export interface EffectEvent extends EventBase {
  readonly kind: "effect";
  /** The tag provided when creating the effect command. */
  readonly tag: string;
  /** Typed outcome of the effect. */
  readonly result: EffectResult;
}

/**
 * Decode a renderer `effect_response` payload into a typed `EffectResult`.
 *
 * Called from the runtime after matching the wire id back to the
 * original `(tag, effectKind)`. The effect kind string (e.g.
 * `"file_open"`) drives the ok-path destructuring. Non-ok statuses
 * map to their non-kind-specific variants.
 */
export function decodeEffectResult(
  effectKind: string,
  status: string,
  result: unknown,
  error: string | null,
): EffectResult {
  if (status === "cancelled") return { kind: "cancelled" };
  if (status === "unsupported") return { kind: "unsupported" };
  if (status === "error") return { kind: "error", message: error ?? "" };
  if (status !== "ok") return { kind: "error", message: `unknown effect status: ${status}` };

  const payload: Record<string, unknown> =
    typeof result === "object" && result !== null ? (result as Record<string, unknown>) : {};

  const asStr = (v: unknown): string => (typeof v === "string" ? v : "");
  const asStrArr = (v: unknown): readonly string[] =>
    Array.isArray(v) ? (v.filter((x) => typeof x === "string") as string[]) : [];

  switch (effectKind) {
    case "file_open":
      return { kind: "file_opened", path: asStr(payload["path"]) };
    case "file_open_multiple":
      return { kind: "files_opened", paths: asStrArr(payload["paths"]) };
    case "file_save":
      return { kind: "file_saved", path: asStr(payload["path"]) };
    case "directory_select":
      return { kind: "directory_selected", path: asStr(payload["path"]) };
    case "directory_select_multiple":
      return { kind: "directories_selected", paths: asStrArr(payload["paths"]) };
    case "clipboard_read":
    case "clipboard_read_primary":
      return { kind: "clipboard_text", text: asStr(payload["text"]) };
    case "clipboard_read_html":
      return {
        kind: "clipboard_html",
        html: asStr(payload["html"]),
        altText: typeof payload["alt_text"] === "string" ? (payload["alt_text"] as string) : null,
      };
    case "clipboard_write":
    case "clipboard_write_html":
    case "clipboard_write_primary":
      return { kind: "clipboard_written" };
    case "clipboard_clear":
      return { kind: "clipboard_cleared" };
    case "notification":
      return { kind: "notification_shown" };
    default:
      return { kind: "error", message: `unknown effect kind: ${effectKind}` };
  }
}

export interface WidgetCommandErrorEvent extends EventBase {
  readonly kind: "widget_command_error";
  readonly reason: string;
  readonly nodeId: string | null;
  readonly family: string | null;
  readonly widgetType: string | null;
  readonly message: string | null;
}

export interface SystemEvent extends EventBase {
  readonly kind: "system";
  readonly type: string;
  readonly tag: string;
  readonly value: unknown;
}

export interface TimerEvent extends EventBase {
  readonly kind: "timer";
  readonly tag: string;
  readonly timestamp: number;
}

export interface AsyncEvent extends EventBase {
  readonly kind: "async";
  readonly tag: string;
  readonly result:
    | { readonly ok: true; readonly value: unknown }
    | { readonly ok: false; readonly error: unknown };
}

export interface StreamEvent extends EventBase {
  readonly kind: "stream";
  readonly tag: string;
  readonly value: unknown;
}

/**
 * A multiplexed session encountered an error. Emitted by the
 * renderer when a session thread panics, hits a session-scoped cap,
 * or otherwise fails.
 *
 * Only delivered when the renderer is run with `--max-sessions > 1`.
 */
export interface SessionErrorEvent extends EventBase {
  readonly kind: "session_error";
  /** The session ID that errored. */
  readonly session: string;
  /**
   * Stable diagnostic code used for programmatic matching. One of:
   * `session_panic`, `max_sessions_reached`, `session_channel_closed`,
   * `writer_dead`, `font_cap_exceeded`, `renderer_panic`,
   * `session_reset_in_progress`, `session_backpressure_overflow`.
   */
  readonly code: string;
  /** Human-readable error description from the renderer. */
  readonly error: string;
}

/**
 * A multiplexed session was closed by the renderer. Emitted after a
 * Reset completes and the session thread exits.
 */
export interface SessionClosedEvent extends EventBase {
  readonly kind: "session_closed";
  /** The session ID that was closed. */
  readonly session: string;
  /** Close reason from the renderer. */
  readonly reason: string;
}

/** Union of all event types. */
export type Event =
  | WidgetEvent
  | KeyEvent
  | ModifiersEvent
  | ImeEvent
  | WindowEvent
  | EffectEvent
  | WidgetCommandErrorEvent
  | SystemEvent
  | TimerEvent
  | AsyncEvent
  | StreamEvent
  | SessionErrorEvent
  | SessionClosedEvent;

/** Reason the renderer exited. */
export type RendererExitType = "crash" | "connection_lost" | "shutdown" | "heartbeat_timeout";

/** Structured error describing why the renderer exited. */
export interface RendererExit {
  readonly type: RendererExitType;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>> | undefined;
}

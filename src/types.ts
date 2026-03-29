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
  readonly tag: string;
  readonly interval?: number;
  readonly maxRate?: number;
  /** Scope the subscription to a specific window. Events from other windows are filtered. */
  readonly windowId?: string | undefined;
}

/**
 * Handler function for widget events. Receives current state and
 * the event, returns new state or [state, command(s)].
 */
export type Handler<S> = (state: S, event: WidgetEvent) => S | readonly [S, Command | Command[]];

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
  | "mouse"
  | "touch"
  | "ime"
  | "window"
  | "effect"
  | "extension_command_error"
  | "system"
  | "timer"
  | "async"
  | "stream";

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
    | "scroll"
    | "sort"
    | "key_binding"
    // Canvas element events
    | "canvas_element_enter"
    | "canvas_element_leave"
    | "canvas_element_click"
    | "canvas_element_drag"
    | "canvas_element_drag_end"
    | "canvas_element_focused"
    | "canvas_element_blurred"
    | "canvas_focused"
    | "canvas_blurred"
    | "canvas_group_focused"
    | "canvas_group_blurred"
    | "canvas_element_key_press"
    | "canvas_element_key_release"
    // Canvas interaction events (press/release/move/scroll on canvas surface)
    | "canvas_press"
    | "canvas_release"
    | "canvas_move"
    | "canvas_scroll"
    // Mouse area events
    | "mouse_right_press"
    | "mouse_right_release"
    | "mouse_middle_press"
    | "mouse_middle_release"
    | "mouse_double_click"
    | "mouse_enter"
    | "mouse_exit"
    | "mouse_move"
    | "mouse_scroll"
    // Pane grid events
    | "pane_resized"
    | "pane_dragged"
    | "pane_clicked"
    | "pane_focus_cycle"
    // Sensor events
    | "sensor_resize"
    // Diagnostic
    | "diagnostic"
    // Allow unrecognized types from native widgets / future protocol versions.
    // The `& {}` preserves autocomplete for the literal types above; plain
    // `| string` would collapse the entire union to `string`.
    | (string & {});
  readonly id: string;
  readonly windowId: string;
  readonly scope: readonly string[];
  readonly value: string | number | boolean | null;
  readonly data: Readonly<Record<string, unknown>> | null;
}

// -- Typed event data interfaces ------------------------------------------
//
// These describe the `data` field shape for specific WidgetEvent types.
// Type guards in events.ts use them to narrow `data` so callers get
// typed field access without manual casts.

/** Data for canvas_press and canvas_release events. */
export interface CanvasInteractionData {
  readonly x: number;
  readonly y: number;
  readonly button: string;
  readonly [key: string]: unknown;
}

/** Data for canvas_move events. */
export interface CanvasMoveData {
  readonly x: number;
  readonly y: number;
  readonly [key: string]: unknown;
}

/** Data for canvas_scroll events. */
export interface CanvasScrollData {
  readonly x: number;
  readonly y: number;
  readonly delta_x: number;
  readonly delta_y: number;
  readonly [key: string]: unknown;
}

/** Data for sensor_resize events. */
export interface SensorResizeData {
  readonly width: number;
  readonly height: number;
  readonly [key: string]: unknown;
}

/** Data for scroll events (scrollable widget). */
export interface ScrollData {
  readonly absolute_x: number;
  readonly absolute_y: number;
  readonly relative_x: number;
  readonly relative_y: number;
  readonly [key: string]: unknown;
}

/** Data for canvas_element_drag events. */
export interface CanvasElementDragData {
  readonly x: number;
  readonly y: number;
  readonly dx: number;
  readonly dy: number;
  readonly [key: string]: unknown;
}

/** Data for canvas_element_key_press events. */
export interface CanvasElementKeyPressData {
  readonly key: string;
  readonly modifiers: Readonly<Record<string, unknown>>;
  readonly text: string;
  readonly [key: string]: unknown;
}

/** Data for canvas_element_key_release events. */
export interface CanvasElementKeyReleaseData {
  readonly key: string;
  readonly modifiers: Readonly<Record<string, unknown>>;
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

export interface MouseEvent extends EventBase {
  readonly kind: "mouse";
  readonly type: "moved" | "entered" | "left" | "pressed" | "released" | "scrolled";
  readonly x: number;
  readonly y: number;
  readonly button: string | null;
  readonly deltaX: number;
  readonly deltaY: number;
  readonly tag: string;
  readonly captured: boolean;
  /** Window that the cursor was in when the event fired, or null for global events. */
  readonly windowId: string | null;
}

export interface TouchEvent extends EventBase {
  readonly kind: "touch";
  readonly type: "pressed" | "moved" | "lifted" | "lost";
  readonly fingerId: number;
  readonly x: number;
  readonly y: number;
  readonly tag: string;
  readonly captured: boolean;
  /** Window that the touch occurred in, or null for global events. */
  readonly windowId: string | null;
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

export interface EffectEvent extends EventBase {
  readonly kind: "effect";
  readonly requestId: string;
  readonly status: "ok" | "cancelled" | "error";
  readonly result: unknown;
  readonly error: string | null;
}

export interface ExtensionCommandErrorEvent extends EventBase {
  readonly kind: "extension_command_error";
  readonly reason: string;
  readonly nodeId: string | null;
  readonly op: string | null;
  readonly extension: string | null;
  readonly message: string | null;
}

export interface SystemEvent extends EventBase {
  readonly kind: "system";
  readonly type: string;
  readonly tag: string;
  readonly data: unknown;
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

/** Union of all event types. */
export type Event =
  | WidgetEvent
  | KeyEvent
  | ModifiersEvent
  | MouseEvent
  | TouchEvent
  | ImeEvent
  | WindowEvent
  | EffectEvent
  | ExtensionCommandErrorEvent
  | SystemEvent
  | TimerEvent
  | AsyncEvent
  | StreamEvent;

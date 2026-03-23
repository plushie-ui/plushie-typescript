/**
 * A node in the UI tree. Every widget builder produces this shape.
 * Sent over the wire as JSON/MessagePack to the renderer.
 */
export interface UINode {
  readonly id: string;
  readonly type: string;
  readonly props: Readonly<Record<string, unknown>>;
  readonly children: readonly UINode[];
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
  | "canvas"
  | "mouse_area"
  | "pane"
  | "sensor"
  | "effect"
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
  readonly type:
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
    | "diagnostic"
    | string; // Allow unrecognized families to pass through
  readonly id: string;
  readonly scope: readonly string[];
  readonly value: string | number | boolean | null;
  readonly data: Readonly<Record<string, unknown>> | null;
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
}

export interface ModifiersEvent extends EventBase {
  readonly kind: "modifiers";
  readonly modifiers: Readonly<Modifiers>;
  readonly tag: string;
  readonly captured: boolean;
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
}

export interface TouchEvent extends EventBase {
  readonly kind: "touch";
  readonly type: "pressed" | "moved" | "lifted" | "lost";
  readonly fingerId: number;
  readonly x: number;
  readonly y: number;
  readonly tag: string;
  readonly captured: boolean;
}

export interface ImeEvent extends EventBase {
  readonly kind: "ime";
  readonly type: "opened" | "preedit" | "commit" | "closed";
  readonly text: string | null;
  readonly cursor: readonly [number, number] | null;
  readonly tag: string;
  readonly captured: boolean;
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

export interface CanvasEvent extends EventBase {
  readonly kind: "canvas";
  readonly type: "press" | "release" | "move" | "scroll";
  readonly id: string;
  readonly scope: readonly string[];
  readonly x: number;
  readonly y: number;
  readonly button: string | null;
  readonly data: Readonly<Record<string, unknown>> | null;
}

export interface MouseAreaEvent extends EventBase {
  readonly kind: "mouse_area";
  readonly type:
    | "enter"
    | "exit"
    | "right_press"
    | "right_release"
    | "middle_press"
    | "middle_release"
    | "double_click"
    | "move"
    | "scroll";
  readonly id: string;
  readonly scope: readonly string[];
  readonly data: Readonly<Record<string, unknown>> | null;
}

export interface PaneEvent extends EventBase {
  readonly kind: "pane";
  readonly type: "clicked" | "resized" | "dragged" | "focus_cycle";
  readonly id: string;
  readonly scope: readonly string[];
  readonly data: Readonly<Record<string, unknown>> | null;
}

export interface SensorEvent extends EventBase {
  readonly kind: "sensor";
  readonly type: "resize";
  readonly id: string;
  readonly scope: readonly string[];
  readonly width: number;
  readonly height: number;
}

export interface EffectEvent extends EventBase {
  readonly kind: "effect";
  readonly requestId: string;
  readonly status: "ok" | "cancelled" | "error";
  readonly result: unknown;
  readonly error: string | null;
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
  | CanvasEvent
  | MouseAreaEvent
  | PaneEvent
  | SensorEvent
  | EffectEvent
  | SystemEvent
  | TimerEvent
  | AsyncEvent
  | StreamEvent;

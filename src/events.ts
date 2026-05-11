/**
 * Event type guards for pattern matching in `update()`.
 *
 * Every event flowing through the Elm update loop is a tagged union
 * (discriminated by the `kind` field). This module provides narrowing
 * guards so you can match events concisely without manual type
 * assertions.
 *
 * Widget-level guards (`isClick`, `isInput`, etc.) optionally accept
 * a widget ID to narrow further. Broader guards (`isKey`, `isPointer`,
 * etc.) match an entire event category.
 *
 * @example
 * ```ts
 * import { isClick, isInput, isKey, target } from "plushie/events"
 *
 * function update(model: Model, event: Event): Model {
 *   if (isClick(event, "increment")) {
 *     return { ...model, count: model.count + 1 }
 *   }
 *   if (isInput(event, "name")) {
 *     return { ...model, name: event.value as string }
 *   }
 *   if (isKey(event, "press") && event.key === "Escape") {
 *     return { ...model, menuOpen: false }
 *   }
 *   return model
 * }
 * ```
 *
 * @module
 */

import type {
  AsyncEvent,
  DragData,
  EffectEvent,
  Event,
  ImeEvent,
  KeyEvent,
  KeyPressData,
  LinkClickData,
  ModifiersEvent,
  PointerData,
  ResizeData,
  ScrolledData,
  SessionClosedEvent,
  SessionErrorEvent,
  StreamEvent,
  SystemEvent,
  TimerEvent,
  WidgetCommandErrorEvent,
  WidgetEvent,
  WindowEvent,
} from "./types.js";

// -- Type guards ----------------------------------------------------------

// Widget event guards, optionally narrowing by widget ID.

/** Narrows to a click event, optionally matching a specific widget ID. */
export function isClick(
  event: Event,
  id?: string,
): event is WidgetEvent & { readonly type: "click" } {
  return event.kind === "widget" && event.type === "click" && (id === undefined || event.id === id);
}

/** Narrows to a text input change event, optionally matching a specific widget ID. */
export function isInput(
  event: Event,
  id?: string,
): event is WidgetEvent & { readonly type: "input" } {
  return event.kind === "widget" && event.type === "input" && (id === undefined || event.id === id);
}

/** Narrows to a submit event (Enter pressed in a text input), optionally matching a widget ID. */
export function isSubmit(
  event: Event,
  id?: string,
): event is WidgetEvent & { readonly type: "submit" } {
  return (
    event.kind === "widget" && event.type === "submit" && (id === undefined || event.id === id)
  );
}

/** Narrows to a toggle event (checkbox/toggler), optionally matching a widget ID. */
export function isToggle(
  event: Event,
  id?: string,
): event is WidgetEvent & { readonly type: "toggle" } {
  return (
    event.kind === "widget" && event.type === "toggle" && (id === undefined || event.id === id)
  );
}

/** Narrows to a focus-gained event, optionally matching a widget ID. */
export function isFocused(
  event: Event,
  id?: string,
): event is WidgetEvent & { readonly type: "focused" } {
  return (
    event.kind === "widget" && event.type === "focused" && (id === undefined || event.id === id)
  );
}

/** Narrows to a focus-lost event, optionally matching a widget ID. */
export function isBlurred(
  event: Event,
  id?: string,
): event is WidgetEvent & { readonly type: "blurred" } {
  return (
    event.kind === "widget" && event.type === "blurred" && (id === undefined || event.id === id)
  );
}

/** Narrows to a select event (pick list, radio, combo box), optionally matching a widget ID. */
export function isSelect(
  event: Event,
  id?: string,
): event is WidgetEvent & { readonly type: "select" } {
  return (
    event.kind === "widget" && event.type === "select" && (id === undefined || event.id === id)
  );
}

/** Narrows to a slide event (slider value changed), optionally matching a widget ID. */
export function isSlide(
  event: Event,
  id?: string,
): event is WidgetEvent & { readonly type: "slide" } {
  return event.kind === "widget" && event.type === "slide" && (id === undefined || event.id === id);
}

// Broader event kind guards.

/** Narrows to any widget event (click, input, submit, toggle, etc.). */
export function isWidget(event: Event): event is WidgetEvent {
  return event.kind === "widget";
}

/** Narrows to a keyboard event, optionally filtering by "press" or "release". */
export function isKey(event: Event, type?: "press" | "release"): event is KeyEvent {
  return event.kind === "key" && (type === undefined || event.type === type);
}

/** Narrows to a modifier key state change event. */
export function isModifiers(event: Event): event is ModifiersEvent {
  return event.kind === "modifiers";
}

/** Narrows to an input method editor (IME) event. */
export function isIme(event: Event): event is ImeEvent {
  return event.kind === "ime";
}

/** Narrows to a window lifecycle event (opened, closed, resized, etc.). */
export function isWindow(event: Event): event is WindowEvent {
  return event.kind === "window";
}

// Pointer event types (unified: covers canvas, pointer_area, and sensor)
const POINTER_TYPES = new Set([
  "press",
  "release",
  "move",
  "scroll",
  "enter",
  "exit",
  "double_click",
]);

/**
 * Narrows to a unified pointer event (press, release, move, scroll,
 * enter, exit, double_click). These replace the old canvas_* and
 * mouse_* event types.
 *
 * Events with spatial data (press, release, move, scroll, double_click)
 * carry `PointerData` in the `data` field. Simple events (enter, exit)
 * may have null data. Use a second check on `event.type` to narrow to
 * a specific pointer event with guaranteed data shape.
 */
export function isPointer(
  event: Event,
  id?: string,
): event is WidgetEvent & {
  readonly type: "press" | "release" | "move" | "scroll" | "enter" | "exit" | "double_click";
} {
  return (
    event.kind === "widget" &&
    POINTER_TYPES.has((event as WidgetEvent).type) &&
    (id === undefined || (event as WidgetEvent).id === id)
  );
}

/**
 * Narrows to a pointer press event with typed pointer data.
 * The data field is guaranteed to contain coordinates, button, and pointer type.
 */
export function isPress(
  event: Event,
  id?: string,
): event is WidgetEvent & { readonly type: "press"; readonly data: PointerData } {
  return (
    event.kind === "widget" &&
    (event as WidgetEvent).type === "press" &&
    (id === undefined || (event as WidgetEvent).id === id)
  );
}

/**
 * Narrows to a pointer release event with typed pointer data.
 */
export function isRelease(
  event: Event,
  id?: string,
): event is WidgetEvent & {
  readonly type: "release";
  readonly data: PointerData & { readonly lost: boolean };
} {
  return (
    event.kind === "widget" &&
    (event as WidgetEvent).type === "release" &&
    (id === undefined || (event as WidgetEvent).id === id)
  );
}

/**
 * Narrows to a pointer move event with typed pointer data.
 */
export function isMove(
  event: Event,
  id?: string,
): event is WidgetEvent & { readonly type: "move"; readonly data: PointerData } {
  return (
    event.kind === "widget" &&
    (event as WidgetEvent).type === "move" &&
    (id === undefined || (event as WidgetEvent).id === id)
  );
}

/**
 * Narrows to a pointer scroll event with typed pointer data
 * (includes delta_x, delta_y).
 */
export function isScroll(
  event: Event,
  id?: string,
): event is WidgetEvent & { readonly type: "scroll"; readonly data: PointerData } {
  return (
    event.kind === "widget" &&
    (event as WidgetEvent).type === "scroll" &&
    (id === undefined || (event as WidgetEvent).id === id)
  );
}

// Pane types
const PANE_TYPES = new Set(["pane_resized", "pane_dragged", "pane_clicked", "pane_focus_cycle"]);

/** Narrows to a pane grid event (resized, dragged, clicked, focus cycle). */
export function isPane(
  event: Event,
  id?: string,
): event is WidgetEvent & {
  readonly type: "pane_resized" | "pane_dragged" | "pane_clicked" | "pane_focus_cycle";
} {
  return (
    event.kind === "widget" &&
    PANE_TYPES.has((event as WidgetEvent).type) &&
    (id === undefined || (event as WidgetEvent).id === id)
  );
}

/** Narrows to a resize event with typed width/height data. */
export function isResize(
  event: Event,
  id?: string,
): event is WidgetEvent & { readonly type: "resize"; readonly data: ResizeData } {
  return (
    event.kind === "widget" &&
    (event as WidgetEvent).type === "resize" &&
    (id === undefined || (event as WidgetEvent).id === id)
  );
}

/** Narrows to a drag event with typed coordinate/delta data. */
export function isDrag(
  event: Event,
  id?: string,
): event is WidgetEvent & { readonly type: "drag"; readonly data: DragData } {
  return (
    event.kind === "widget" &&
    (event as WidgetEvent).type === "drag" &&
    (id === undefined || (event as WidgetEvent).id === id)
  );
}

/** Narrows to a scrolled event (scrollable viewport position changed). */
export function isScrolled(
  event: Event,
  id?: string,
): event is WidgetEvent & { readonly type: "scrolled"; readonly data: ScrolledData } {
  return (
    event.kind === "widget" &&
    (event as WidgetEvent).type === "scrolled" &&
    (id === undefined || (event as WidgetEvent).id === id)
  );
}

/**
 * Narrows to a link_click event emitted by a link-capable widget
 * (rich_text, markdown). Data is guaranteed to carry the clicked link.
 */
export function isLinkClicked(
  event: Event,
  id?: string,
): event is WidgetEvent & { readonly type: "link_click"; readonly data: LinkClickData } {
  return (
    event.kind === "widget" &&
    (event as WidgetEvent).type === "link_click" &&
    (id === undefined || (event as WidgetEvent).id === id)
  );
}

/** Narrows to a widget-scoped key_press event with typed key/modifiers data. */
export function isWidgetKeyPress(
  event: Event,
  id?: string,
): event is WidgetEvent & { readonly type: "key_press"; readonly data: KeyPressData } {
  return (
    event.kind === "widget" &&
    (event as WidgetEvent).type === "key_press" &&
    (id === undefined || (event as WidgetEvent).id === id)
  );
}

/** Narrows to an effect response event, optionally matching a tag. */
export function isEffect(event: Event, tag?: string): event is EffectEvent {
  return event.kind === "effect" && (tag === undefined || event.tag === tag);
}

/** Narrows to a system event (animation frame, theme change, etc.), optionally matching a type. */
export function isSystem(event: Event, type?: string): event is SystemEvent {
  return event.kind === "system" && (type === undefined || event.type === type);
}

/** Narrows to a native widget command error event. */
export function isWidgetCommandError(event: Event): event is WidgetCommandErrorEvent {
  return event.kind === "widget_command_error";
}

/** Narrows to a timer event, optionally matching a subscription tag. */
export function isTimer(event: Event, tag?: string): event is TimerEvent {
  return event.kind === "timer" && (tag === undefined || event.tag === tag);
}

/** Narrows to an async task completion event, optionally matching a task tag. */
export function isAsync(event: Event, tag?: string): event is AsyncEvent {
  return event.kind === "async" && (tag === undefined || event.tag === tag);
}

/** Narrows to a stream chunk event, optionally matching a stream tag. */
export function isStream(event: Event, tag?: string): event is StreamEvent {
  return event.kind === "stream" && (tag === undefined || event.tag === tag);
}

/**
 * Narrows to a multiplexed session_error event. Optionally matches a
 * specific session ID.
 */
export function isSessionError(event: Event, session?: string): event is SessionErrorEvent {
  return event.kind === "session_error" && (session === undefined || event.session === session);
}

/**
 * Narrows to a multiplexed session_closed event. Optionally matches a
 * specific session ID.
 */
export function isSessionClosed(event: Event, session?: string): event is SessionClosedEvent {
  return event.kind === "session_closed" && (session === undefined || event.session === session);
}

/**
 * Reconstruct the full scoped ID path from a widget event.
 *
 * Strips the window_id from the scope chain (it's the outermost
 * ancestor, always at the end of the reversed scope list). The
 * window_id is already available as `event.windowId`.
 *
 * e.g. { id: "save", scope: ["form", "main"], windowId: "main" } -> "form/save"
 */
export function target(event: WidgetEvent): string {
  // Filter out the window_id from scope (last element in reversed list)
  const scope =
    event.windowId &&
    event.scope.length > 0 &&
    event.scope[event.scope.length - 1] === event.windowId
      ? event.scope.slice(0, -1)
      : event.scope;
  if (scope.length === 0) return event.id;
  return [...scope].reverse().join("/") + "/" + event.id;
}

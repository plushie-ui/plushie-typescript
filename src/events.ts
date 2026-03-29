/**
 * Event type guards for pattern matching in `update()`.
 *
 * Every event flowing through the Elm update loop is a tagged union
 * (discriminated by the `kind` field). This module provides narrowing
 * guards so you can match events concisely without manual type
 * assertions.
 *
 * Widget-level guards (`isClick`, `isInput`, etc.) optionally accept
 * a widget ID to narrow further. Broader guards (`isKey`, `isMouse`,
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
  EffectEvent,
  Event,
  ExtensionCommandErrorEvent,
  ImeEvent,
  KeyEvent,
  ModifiersEvent,
  MouseEvent,
  StreamEvent,
  SystemEvent,
  TimerEvent,
  TouchEvent,
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

/** Narrows to a mouse event (move, button, scroll). */
export function isMouse(event: Event): event is MouseEvent {
  return event.kind === "mouse";
}

/** Narrows to a touch event (press, move, lift, lost). */
export function isTouch(event: Event): event is TouchEvent {
  return event.kind === "touch";
}

/** Narrows to an input method editor (IME) event. */
export function isIme(event: Event): event is ImeEvent {
  return event.kind === "ime";
}

/** Narrows to a window lifecycle event (opened, closed, resized, etc.). */
export function isWindow(event: Event): event is WindowEvent {
  return event.kind === "window";
}

// Canvas interaction types
const CANVAS_TYPES = new Set(["canvas_press", "canvas_release", "canvas_move", "canvas_scroll"]);

/** Narrows to a canvas interaction event (press, release, move, scroll on the canvas surface). */
export function isCanvas(
  event: Event,
  id?: string,
): event is WidgetEvent & {
  readonly type: "canvas_press" | "canvas_release" | "canvas_move" | "canvas_scroll";
} {
  return (
    event.kind === "widget" &&
    CANVAS_TYPES.has((event as WidgetEvent).type) &&
    (id === undefined || (event as WidgetEvent).id === id)
  );
}

// Mouse area types
const MOUSE_AREA_TYPES = new Set([
  "mouse_right_press",
  "mouse_right_release",
  "mouse_middle_press",
  "mouse_middle_release",
  "mouse_double_click",
  "mouse_enter",
  "mouse_exit",
  "mouse_move",
  "mouse_scroll",
]);

/** Narrows to a mouse area event (right click, double click, enter, exit, etc.). */
export function isMouseArea(
  event: Event,
  id?: string,
): event is WidgetEvent & {
  readonly type:
    | "mouse_right_press"
    | "mouse_right_release"
    | "mouse_middle_press"
    | "mouse_middle_release"
    | "mouse_double_click"
    | "mouse_enter"
    | "mouse_exit"
    | "mouse_move"
    | "mouse_scroll";
} {
  return (
    event.kind === "widget" &&
    MOUSE_AREA_TYPES.has((event as WidgetEvent).type) &&
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

/** Narrows to a sensor resize event. */
export function isSensor(
  event: Event,
  id?: string,
): event is WidgetEvent & { readonly type: "sensor_resize" } {
  return (
    event.kind === "widget" &&
    (event as WidgetEvent).type === "sensor_resize" &&
    (id === undefined || (event as WidgetEvent).id === id)
  );
}

/** Narrows to an effect response event, optionally matching a request ID. */
export function isEffect(event: Event, requestId?: string): event is EffectEvent {
  return event.kind === "effect" && (requestId === undefined || event.requestId === requestId);
}

/** Narrows to a system event (animation frame, theme change, etc.), optionally matching a type. */
export function isSystem(event: Event, type?: string): event is SystemEvent {
  return event.kind === "system" && (type === undefined || event.type === type);
}

/** Narrows to a native extension command error event. */
export function isExtensionCommandError(event: Event): event is ExtensionCommandErrorEvent {
  return event.kind === "extension_command_error";
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
 * Reconstruct the full scoped ID path from a widget event.
 * e.g. { id: "save", scope: ["form", "app"] } -> "app/form/save"
 */
export function target(event: WidgetEvent): string {
  if (event.scope.length === 0) return event.id;
  return [...event.scope].reverse().join("/") + "/" + event.id;
}

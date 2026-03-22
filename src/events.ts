import type {
  Event,
  WidgetEvent,
  KeyEvent,
  MouseEvent,
  TouchEvent,
  ImeEvent,
  WindowEvent,
  CanvasEvent,
  MouseAreaEvent,
  PaneEvent,
  SensorEvent,
  EffectEvent,
  SystemEvent,
  TimerEvent,
  AsyncEvent,
  StreamEvent,
} from "./types.js"

// -- Type guards ----------------------------------------------------------

// Widget event guards, optionally narrowing by widget ID.

export function isClick(
  event: Event,
  id?: string,
): event is WidgetEvent & { readonly type: "click" } {
  return (
    event.kind === "widget" &&
    event.type === "click" &&
    (id === undefined || event.id === id)
  )
}

export function isInput(
  event: Event,
  id?: string,
): event is WidgetEvent & { readonly type: "input" } {
  return (
    event.kind === "widget" &&
    event.type === "input" &&
    (id === undefined || event.id === id)
  )
}

export function isSubmit(
  event: Event,
  id?: string,
): event is WidgetEvent & { readonly type: "submit" } {
  return (
    event.kind === "widget" &&
    event.type === "submit" &&
    (id === undefined || event.id === id)
  )
}

export function isToggle(
  event: Event,
  id?: string,
): event is WidgetEvent & { readonly type: "toggle" } {
  return (
    event.kind === "widget" &&
    event.type === "toggle" &&
    (id === undefined || event.id === id)
  )
}

export function isSelect(
  event: Event,
  id?: string,
): event is WidgetEvent & { readonly type: "select" } {
  return (
    event.kind === "widget" &&
    event.type === "select" &&
    (id === undefined || event.id === id)
  )
}

export function isSlide(
  event: Event,
  id?: string,
): event is WidgetEvent & { readonly type: "slide" } {
  return (
    event.kind === "widget" &&
    event.type === "slide" &&
    (id === undefined || event.id === id)
  )
}

// Broader event kind guards.

export function isWidget(event: Event): event is WidgetEvent {
  return event.kind === "widget"
}

export function isKey(
  event: Event,
  type?: "press" | "release",
): event is KeyEvent {
  return event.kind === "key" && (type === undefined || event.type === type)
}

export function isMouse(event: Event): event is MouseEvent {
  return event.kind === "mouse"
}

export function isTouch(event: Event): event is TouchEvent {
  return event.kind === "touch"
}

export function isIme(event: Event): event is ImeEvent {
  return event.kind === "ime"
}

export function isWindow(event: Event): event is WindowEvent {
  return event.kind === "window"
}

export function isCanvas(event: Event): event is CanvasEvent {
  return event.kind === "canvas"
}

export function isMouseArea(event: Event): event is MouseAreaEvent {
  return event.kind === "mouse_area"
}

export function isPane(event: Event): event is PaneEvent {
  return event.kind === "pane"
}

export function isSensor(event: Event): event is SensorEvent {
  return event.kind === "sensor"
}

export function isEffect(
  event: Event,
  requestId?: string,
): event is EffectEvent {
  return (
    event.kind === "effect" &&
    (requestId === undefined || event.requestId === requestId)
  )
}

export function isSystem(event: Event, type?: string): event is SystemEvent {
  return (
    event.kind === "system" && (type === undefined || event.type === type)
  )
}

export function isTimer(event: Event, tag?: string): event is TimerEvent {
  return (
    event.kind === "timer" && (tag === undefined || event.tag === tag)
  )
}

export function isAsync(event: Event, tag?: string): event is AsyncEvent {
  return (
    event.kind === "async" && (tag === undefined || event.tag === tag)
  )
}

export function isStream(event: Event, tag?: string): event is StreamEvent {
  return (
    event.kind === "stream" && (tag === undefined || event.tag === tag)
  )
}

/**
 * Reconstruct the full scoped ID path from a widget event.
 * e.g. { id: "save", scope: ["form", "app"] } -> "app/form/save"
 */
export function target(event: WidgetEvent): string {
  if (event.scope.length === 0) return event.id
  return [...event.scope].reverse().join("/") + "/" + event.id
}

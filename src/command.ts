import { COMMAND } from "./types.js"
import type { Command } from "./types.js"

function cmd(type: string, payload: Record<string, unknown> = {}): Command {
  return Object.freeze({ [COMMAND]: true as const, type, payload })
}

/** Check whether a value is a Command. */
export function isCommand(value: unknown): value is Command {
  return (
    typeof value === "object" &&
    value !== null &&
    COMMAND in value &&
    (value as Record<symbol, unknown>)[COMMAND] === true
  )
}

// -- Command constructors -------------------------------------------------

/** No-op command. */
export function none(): Command {
  return cmd("none")
}

/** Combine multiple commands into one. */
export function batch(commands: Command[]): Command {
  return cmd("batch", { commands })
}

/** Exit the application. */
export function exit(): Command {
  return cmd("exit")
}

/**
 * Run an async function. The result is delivered as an AsyncEvent
 * with the given tag. The function receives an AbortSignal for
 * cooperative cancellation.
 */
function async_(
  fn: (signal: AbortSignal) => Promise<unknown>,
  tag: string,
): Command {
  return cmd("async", { fn, tag })
}
export { async_ as async }

/**
 * Run an async generator as a stream. Each yielded value is delivered
 * as a StreamEvent. The final return value is delivered as an AsyncEvent.
 */
export function stream(
  fn: (signal: AbortSignal) => AsyncIterable<unknown>,
  tag: string,
): Command {
  return cmd("stream", { fn, tag })
}

/** Cancel a running async or stream task by tag. */
export function cancel(tag: string): Command {
  return cmd("cancel", { tag })
}

/** Schedule an event to be dispatched after a delay. */
export function sendAfter(delayMs: number, event: unknown): Command {
  return cmd("send_after", { delay: delayMs, event })
}

/** Focus a widget by its scoped ID path. */
export function focus(widgetId: string): Command {
  return cmd("focus", { target: widgetId })
}

/** Move focus to the next focusable widget. */
export function focusNext(): Command {
  return cmd("focus_next")
}

/** Move focus to the previous focusable widget. */
export function focusPrevious(): Command {
  return cmd("focus_previous")
}

/** Select all text in a widget. */
export function selectAll(widgetId: string): Command {
  return cmd("select_all", { target: widgetId })
}

/** Scroll a scrollable widget to an absolute offset. */
export function scrollTo(
  widgetId: string,
  offsetX: number,
  offsetY: number,
): Command {
  return cmd("scroll_to", { target: widgetId, offset_x: offsetX, offset_y: offsetY })
}

/** Scroll a scrollable widget by a relative amount. */
export function scrollBy(
  widgetId: string,
  x: number,
  y: number,
): Command {
  return cmd("scroll_by", { target: widgetId, offset_x: x, offset_y: y })
}

/** Snap a scrollable to a relative position (0.0 - 1.0). */
export function snapTo(widgetId: string, x: number, y: number): Command {
  return cmd("snap_to", { target: widgetId, x, y })
}

/** Snap a scrollable to the end of its content. */
export function snapToEnd(widgetId: string): Command {
  return cmd("snap_to_end", { target: widgetId })
}

/** Close a window by ID. */
export function closeWindow(windowId: string): Command {
  return cmd("close_window", { window_id: windowId })
}

/** Resize a window. */
export function resizeWindow(
  windowId: string,
  width: number,
  height: number,
): Command {
  return cmd("window_op", { op: "resize", window_id: windowId, width, height })
}

/** Move a window. */
export function moveWindow(windowId: string, x: number, y: number): Command {
  return cmd("window_op", { op: "move", window_id: windowId, x, y })
}

/** Screen reader announcement. */
export function announce(text: string): Command {
  return cmd("announce", { text })
}

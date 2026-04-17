/**
 * Commands: pure data descriptions of side effects.
 *
 * Commands are returned from `update()` alongside the new model to request
 * side effects without performing them directly. The runtime interprets
 * each command and dispatches the corresponding wire messages or async
 * operations.
 *
 * Commands are immutable frozen objects identified by a branded symbol.
 * Use the constructor functions in this module to create them; never
 * construct the raw objects by hand.
 *
 * @example
 * ```ts
 * import * as Cmd from "plushie/command"
 *
 * function update(model: Model, event: Event): [Model, Command] {
 *   if (isClick(event, "save")) {
 *     return [model, Cmd.async(saveToServer, "save-result")]
 *   }
 *   if (isClick(event, "quit")) {
 *     return [model, Cmd.exit()]
 *   }
 *   return [model, Cmd.none()]
 * }
 * ```
 *
 * @module
 */

import type { Command } from "./types.js";
import { COMMAND } from "./types.js";

function cmd(type: string, payload: Record<string, unknown> = {}): Command {
  return Object.freeze({ [COMMAND]: true as const, type, payload });
}

/** Check whether a value is a Command. */
export function isCommand(value: unknown): value is Command {
  return (
    typeof value === "object" &&
    value !== null &&
    COMMAND in value &&
    (value as Record<symbol, unknown>)[COMMAND] === true
  );
}

// -- Command constructors -------------------------------------------------

/** No-op command. */
export function none(): Command {
  return cmd("none");
}

/**
 * Combine multiple commands into one. Commands in the batch execute
 * sequentially in list order, with state threaded through each.
 */
export function batch(commands: Command[]): Command {
  return cmd("batch", { commands });
}

/** Exit the application. */
export function exit(): Command {
  return cmd("exit");
}

/**
 * Run an async function. The result is delivered as an AsyncEvent
 * with the given tag. The function receives an AbortSignal for
 * cooperative cancellation.
 *
 * Only one task per tag can be active. If a task with the same tag is
 * already running, it is cancelled and replaced. Use unique tags if you
 * need concurrent tasks.
 */
function async_(fn: (signal: AbortSignal) => Promise<unknown>, tag: string): Command {
  return cmd("async", { fn, tag });
}

export { async_ as async };

/**
 * Run an async generator as a stream. Each yielded value is delivered
 * as a StreamEvent. The final return value is delivered as an AsyncEvent.
 *
 * Only one task per tag can be active. If a task with the same tag is
 * already running, it is cancelled and replaced. Use unique tags if you
 * need concurrent streams.
 */
export function stream(fn: (signal: AbortSignal) => AsyncIterable<unknown>, tag: string): Command {
  return cmd("stream", { fn, tag });
}

/** Cancel a running async or stream task by tag. */
export function cancel(tag: string): Command {
  return cmd("cancel", { tag });
}

/**
 * Schedule an event to be dispatched after a delay.
 *
 * If a timer with the same event is already pending, the previous
 * timer is cancelled and replaced. This prevents duplicate deliveries
 * when sendAfter is called repeatedly for the same event.
 */
export function sendAfter(delayMs: number, event: unknown): Command {
  return cmd("send_after", { delay: delayMs, event });
}

/** Focus a widget by its scoped ID path. Supports `"window#path"`. */
export function focus(widgetId: string): Command {
  return widgetCommand(widgetId, "focus");
}

/** Move focus to the next focusable widget. */
export function focusNext(): Command {
  return cmd("widget_op", { op: "focus_next" });
}

/** Move focus to the previous focusable widget. */
export function focusPrevious(): Command {
  return cmd("widget_op", { op: "focus_previous" });
}

/** Select all text in a widget. Supports `"window#path"`. */
export function selectAll(widgetId: string): Command {
  return widgetCommand(widgetId, "select_all");
}

/** Scroll a scrollable widget to an absolute offset. Supports `"window#path"`. */
export function scrollTo(widgetId: string, offsetX: number, offsetY: number): Command {
  return widgetCommand(widgetId, "scroll_to", { offset_x: offsetX, offset_y: offsetY });
}

/** Scroll a scrollable widget by a relative amount. Supports `"window#path"`. */
export function scrollBy(widgetId: string, x: number, y: number): Command {
  return widgetCommand(widgetId, "scroll_by", { offset_x: x, offset_y: y });
}

/** Snap a scrollable to a relative position (0.0 - 1.0). Supports `"window#path"`. */
export function snapTo(widgetId: string, x: number, y: number): Command {
  return widgetCommand(widgetId, "snap_to", { x, y });
}

/** Snap a scrollable to the end of its content. Supports `"window#path"`. */
export function snapToEnd(widgetId: string): Command {
  return widgetCommand(widgetId, "snap_to_end");
}

/** Close a window by ID. */
export function closeWindow(windowId: string): Command {
  return cmd("close_window", { window_id: windowId });
}

/** Resize a window. */
export function resizeWindow(windowId: string, width: number, height: number): Command {
  return cmd("window_op", { op: "resize", window_id: windowId, width, height });
}

/** Move a window. */
export function moveWindow(windowId: string, x: number, y: number): Command {
  return cmd("window_op", { op: "move", window_id: windowId, x, y });
}

/** Screen reader announcement. */
export function announce(text: string): Command {
  return cmd("widget_op", { op: "announce", text });
}

// -- Text editing -----------------------------------------------------------

/** Move the text cursor to the front of the input. Supports `"window#path"`. */
export function moveCursorToFront(widgetId: string): Command {
  return widgetCommand(widgetId, "move_cursor_to_front");
}

/** Move the text cursor to the end of the input. Supports `"window#path"`. */
export function moveCursorToEnd(widgetId: string): Command {
  return widgetCommand(widgetId, "move_cursor_to_end");
}

/** Move the text cursor to a specific position. Supports `"window#path"`. */
export function moveCursorTo(widgetId: string, position: number): Command {
  return widgetCommand(widgetId, "move_cursor_to", position);
}

/** Select a range of text in the input. Supports `"window#path"`. */
export function selectRange(widgetId: string, startPos: number, endPos: number): Command {
  return widgetCommand(widgetId, "select_range", { start_pos: startPos, end_pos: endPos });
}

// -- Window operations ------------------------------------------------------

/** Maximize or restore a window. */
export function maximizeWindow(windowId: string, maximized = true): Command {
  return cmd("window_op", { op: "maximize", window_id: windowId, maximized });
}

/** Minimize or restore a window. */
export function minimizeWindow(windowId: string, minimized = true): Command {
  return cmd("window_op", { op: "minimize", window_id: windowId, minimized });
}

/** Set window mode (windowed, fullscreen, etc.). */
export function setWindowMode(windowId: string, mode: string): Command {
  return cmd("window_op", { op: "set_mode", window_id: windowId, mode });
}

/** Toggle window maximized state. */
export function toggleMaximize(windowId: string): Command {
  return cmd("window_op", { op: "toggle_maximize", window_id: windowId });
}

/** Toggle window decorations (title bar, borders). */
export function toggleDecorations(windowId: string): Command {
  return cmd("window_op", { op: "toggle_decorations", window_id: windowId });
}

/** Give focus to a window. */
export function gainFocus(windowId: string): Command {
  return cmd("window_op", { op: "gain_focus", window_id: windowId });
}

/** Set window stacking level (normal, always_on_top, always_on_bottom). */
export function setWindowLevel(windowId: string, level: string): Command {
  return cmd("window_op", { op: "set_level", window_id: windowId, level });
}

/** Start dragging the window. */
export function dragWindow(windowId: string): Command {
  return cmd("window_op", { op: "drag", window_id: windowId });
}

/** Start drag-resizing the window from the given edge/corner direction. */
export function dragResizeWindow(windowId: string, direction: string): Command {
  return cmd("window_op", { op: "drag_resize", window_id: windowId, direction });
}

/** Request user attention for a window. Urgency can be "informational" or "critical". */
export function requestAttention(windowId: string, urgency: string | null = null): Command {
  return cmd("window_op", { op: "request_attention", window_id: windowId, urgency });
}

/** Set whether a window is resizable. */
export function setResizable(windowId: string, resizable: boolean): Command {
  return cmd("window_op", { op: "set_resizable", window_id: windowId, resizable });
}

/** Set the minimum size of a window. */
export function setMinSize(windowId: string, width: number, height: number): Command {
  return cmd("window_op", { op: "set_min_size", window_id: windowId, width, height });
}

/** Set the maximum size of a window. */
export function setMaxSize(windowId: string, width: number, height: number): Command {
  return cmd("window_op", { op: "set_max_size", window_id: windowId, width, height });
}

/** Enable mouse passthrough on a window (clicks pass through to windows below). */
export function enableMousePassthrough(windowId: string): Command {
  return cmd("window_op", { op: "mouse_passthrough", window_id: windowId, enabled: true });
}

/** Disable mouse passthrough on a window. */
export function disableMousePassthrough(windowId: string): Command {
  return cmd("window_op", { op: "mouse_passthrough", window_id: windowId, enabled: false });
}

/** Show the system menu for a window. */
export function showSystemMenu(windowId: string): Command {
  return cmd("window_op", { op: "show_system_menu", window_id: windowId });
}

/** Sets the resize increment size for a window. */
export function setResizeIncrements(
  windowId: string,
  width: number | null,
  height: number | null,
): Command {
  return cmd("window_op", {
    op: "set_resize_increments",
    window_id: windowId,
    width,
    height,
  });
}

/** Sets whether the system can automatically organize windows into tabs (macOS). */
export function allowAutomaticTabbing(enabled: boolean): Command {
  return cmd("system_op", { op: "allow_automatic_tabbing", enabled });
}

/** Sets the window icon from raw RGBA pixel data. */
export function setIcon(
  windowId: string,
  rgbaData: Uint8Array,
  width: number,
  height: number,
): Command {
  return cmd("window_op", {
    op: "set_icon",
    window_id: windowId,
    icon_data: rgbaData,
    width,
    height,
  });
}

/** Take a screenshot of a window. Result arrives as a tagged event. */
export function screenshotWindow(windowId: string, tag: string): Command {
  return cmd("window_op", { op: "screenshot", window_id: windowId, tag });
}

// -- Window queries ---------------------------------------------------------

/** Query the size of a window. */
export function getWindowSize(windowId: string, tag: string): Command {
  return cmd("window_query", { op: "get_size", window_id: windowId, tag });
}

/** Query the position of a window. */
export function getWindowPosition(windowId: string, tag: string): Command {
  return cmd("window_query", { op: "get_position", window_id: windowId, tag });
}

/** Query whether a window is maximized. */
export function isMaximized(windowId: string, tag: string): Command {
  return cmd("window_query", { op: "is_maximized", window_id: windowId, tag });
}

/** Query whether a window is minimized. */
export function isMinimized(windowId: string, tag: string): Command {
  return cmd("window_query", { op: "is_minimized", window_id: windowId, tag });
}

/** Query the current window mode (windowed, fullscreen, hidden). */
export function getMode(windowId: string, tag: string): Command {
  return cmd("window_query", { op: "get_mode", window_id: windowId, tag });
}

/** Query the window's current scale factor (DPI scaling). */
export function getScaleFactor(windowId: string, tag: string): Command {
  return cmd("window_query", { op: "get_scale_factor", window_id: windowId, tag });
}

/** Query the raw platform window ID (e.g. X11 window ID, HWND). */
export function rawId(windowId: string, tag: string): Command {
  return cmd("window_query", { op: "raw_id", window_id: windowId, tag });
}

/** Query the monitor size for the display containing a window. */
export function monitorSize(windowId: string, tag: string): Command {
  return cmd("window_query", { op: "monitor_size", window_id: windowId, tag });
}

// -- System queries ---------------------------------------------------------

/** Query the current system theme (light/dark mode). */
export function getSystemTheme(tag: string): Command {
  return cmd("system_query", { op: "get_system_theme", tag });
}

/** Query system information (OS, CPU, memory, graphics). */
export function getSystemInfo(tag: string): Command {
  return cmd("system_query", { op: "get_system_info", tag });
}

// -- Image operations -------------------------------------------------------

/** Creates an in-memory image from encoded PNG/JPEG bytes. */
export function createImage(handle: string, data: Uint8Array): Command;
/** Creates an in-memory image from raw RGBA pixel data. */
export function createImage(
  handle: string,
  width: number,
  height: number,
  pixels: Uint8Array,
): Command;
export function createImage(
  handle: string,
  dataOrWidth: Uint8Array | number,
  height?: number,
  pixels?: Uint8Array,
): Command {
  if (typeof dataOrWidth === "number") {
    return cmd("image_op", {
      op: "create_image",
      handle,
      width: dataOrWidth,
      height: height!,
      pixels: pixels!,
    });
  }
  return cmd("image_op", { op: "create_image", handle, data: dataOrWidth });
}

/** Updates an existing in-memory image with new encoded PNG/JPEG bytes. */
export function updateImage(handle: string, data: Uint8Array): Command;
/** Updates an existing in-memory image with new raw RGBA pixel data. */
export function updateImage(
  handle: string,
  width: number,
  height: number,
  pixels: Uint8Array,
): Command;
export function updateImage(
  handle: string,
  dataOrWidth: Uint8Array | number,
  height?: number,
  pixels?: Uint8Array,
): Command {
  if (typeof dataOrWidth === "number") {
    return cmd("image_op", {
      op: "update_image",
      handle,
      width: dataOrWidth,
      height: height!,
      pixels: pixels!,
    });
  }
  return cmd("image_op", { op: "update_image", handle, data: dataOrWidth });
}

/** Deletes an in-memory image by handle name. */
export function deleteImage(handle: string): Command {
  return cmd("image_op", { op: "delete_image", handle });
}

/** Lists all in-memory image handles. Result arrives as a tagged event. */
export function listImages(tag: string): Command {
  return cmd("widget_op", { op: "list_images", tag });
}

/** Clears all in-memory images. */
export function clearImages(): Command {
  return cmd("widget_op", { op: "clear_images" });
}

// -- Pane operations --------------------------------------------------------

/** Split a pane in the pane grid along the given axis. */
export function paneSplit(
  paneGridId: string,
  paneId: string,
  axis: string,
  newPaneId: string,
): Command {
  return widgetCommand(paneGridId, "pane_split", {
    pane: paneId,
    axis,
    new_pane_id: newPaneId,
  });
}

/** Close a pane in the pane grid. */
export function paneClose(paneGridId: string, paneId: string): Command {
  return widgetCommand(paneGridId, "pane_close", { pane: paneId });
}

/** Swap two panes in the pane grid. */
export function paneSwap(paneGridId: string, paneA: string, paneB: string): Command {
  return widgetCommand(paneGridId, "pane_swap", { a: paneA, b: paneB });
}

/** Maximize a pane in the pane grid. */
export function paneMaximize(paneGridId: string, paneId: string): Command {
  return widgetCommand(paneGridId, "pane_maximize", { pane: paneId });
}

/** Restore all panes from maximized state. */
export function paneRestore(paneGridId: string): Command {
  return widgetCommand(paneGridId, "pane_restore");
}

// -- Widget commands -------------------------------------------------------

/** Send a command to a widget by ID using the unified wire format. */
export function widgetCommand(id: string, family: string, value?: unknown): Command {
  return cmd("command", { id, family, value: value ?? null });
}

/** Send a batch of widget commands (processed in one cycle). */
export function widgetCommands(
  commands: Array<{ id: string; family: string; value?: unknown }>,
): Command {
  return cmd("commands", { commands });
}

// -- Other ------------------------------------------------------------------

/** Advance the animation clock by one frame in headless/test mode. */
export function advanceFrame(timestamp: number): Command {
  return cmd("advance_frame", { timestamp });
}

/** Load a font at runtime from binary data. */
export function loadFont(data: Uint8Array): Command {
  return cmd("widget_op", { op: "load_font", data });
}

/** Query which widget currently has focus. */
export function findFocused(tag: string): Command {
  return cmd("widget_op", { op: "find_focused", tag });
}

/** Compute a SHA-256 hash of the renderer's current tree state. */
export function treeHash(tag: string): Command {
  return cmd("widget_op", { op: "tree_hash", tag });
}

/**
 * Wrap an already-resolved value through a mapper function.
 * The runtime immediately dispatches mapper(value) through update
 * without spawning a task.
 */
export function done(value: unknown, mapper: (v: unknown) => unknown): Command {
  return cmd("done", { value, mapper });
}

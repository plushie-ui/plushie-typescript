/**
 * Subscriptions -- declarative event source registrations.
 *
 * Subscriptions tell the runtime which global events the app wants to
 * receive (keyboard, mouse, window lifecycle, animation frames, etc.).
 * The `subscribe()` callback returns a list of active subscriptions
 * each cycle. The runtime diffs this list, starting new subscriptions
 * and stopping removed ones automatically.
 *
 * Each subscription has a `tag` that is included in the resulting events
 * so the app can route them in `update()`.
 *
 * Subscriptions can be scoped to a specific window via the `window`
 * option. The renderer filters events by window before emitting,
 * so the SDK only receives events matching the subscription's scope.
 * Subscriptions without a window scope receive events from all windows.
 *
 * @example
 * ```ts
 * import * as Sub from "plushie/subscription"
 *
 * function subscribe(model: Model): Subscription[] {
 *   const subs = [Sub.onWindowClose("win-close")]
 *   if (model.animating) {
 *     subs.push(Sub.onAnimationFrame("anim"))
 *   }
 *   return subs
 * }
 * ```
 *
 * @module
 */

import type { Subscription } from "./types.js";

/** Common options for subscription constructors. */
export interface SubOpts {
  readonly maxRate?: number;
  /** Scope this subscription to a specific window. */
  readonly window?: string;
}

function sub(
  type: string,
  tag: string,
  opts?: { interval?: number; maxRate?: number; window?: string },
): Subscription {
  const s: {
    type: string;
    tag: string;
    interval?: number;
    maxRate?: number;
    windowId?: string;
  } = { type, tag };
  if (opts?.interval !== undefined) s.interval = opts.interval;
  if (opts?.maxRate !== undefined) s.maxRate = opts.maxRate;
  if (opts?.window !== undefined) s.windowId = opts.window;
  return Object.freeze(s);
}

/** Timer that fires every `intervalMs` milliseconds. */
export function every(intervalMs: number, tag: string): Subscription {
  return sub("every", tag, { interval: intervalMs });
}

/** Subscribe to key press events. */
export function onKeyPress(tag: string, opts?: SubOpts): Subscription {
  return sub("on_key_press", tag, opts);
}

/** Subscribe to key release events. */
export function onKeyRelease(tag: string, opts?: SubOpts): Subscription {
  return sub("on_key_release", tag, opts);
}

/** Subscribe to mouse move events. */
export function onMouseMove(tag: string, opts?: SubOpts): Subscription {
  return sub("on_mouse_move", tag, opts);
}

/** Subscribe to mouse button events. */
export function onMouseButton(tag: string, opts?: SubOpts): Subscription {
  return sub("on_mouse_button", tag, opts);
}

/** Subscribe to mouse scroll events. */
export function onMouseScroll(tag: string, opts?: SubOpts): Subscription {
  return sub("on_mouse_scroll", tag, opts);
}

/** Subscribe to window close requests. */
export function onWindowClose(tag: string, opts?: SubOpts): Subscription {
  return sub("on_window_close", tag, opts);
}

/** Subscribe to window resize events. */
export function onWindowResize(tag: string, opts?: SubOpts): Subscription {
  return sub("on_window_resize", tag, opts);
}

/** Subscribe to window focus events. */
export function onWindowFocus(tag: string, opts?: SubOpts): Subscription {
  return sub("on_window_focus", tag, opts);
}

/** Subscribe to window unfocus events. */
export function onWindowUnfocus(tag: string, opts?: SubOpts): Subscription {
  return sub("on_window_unfocus", tag, opts);
}

/** Subscribe to animation frame events. */
export function onAnimationFrame(tag: string, opts?: SubOpts): Subscription {
  return sub("on_animation_frame", tag, opts);
}

/** Subscribe to system theme changes. */
export function onThemeChange(tag: string, opts?: SubOpts): Subscription {
  return sub("on_theme_change", tag, opts);
}

/** Subscribe to touch events. */
export function onTouch(tag: string, opts?: SubOpts): Subscription {
  return sub("on_touch", tag, opts);
}

/** Subscribe to IME events. */
export function onIme(tag: string, opts?: SubOpts): Subscription {
  return sub("on_ime", tag, opts);
}

/** Subscribe to file drop events. */
export function onFileDrop(tag: string, opts?: SubOpts): Subscription {
  return sub("on_file_drop", tag, opts);
}

/** Subscribe to general window events (resize, move, focus, etc.). */
export function onWindowEvent(tag: string, opts?: SubOpts): Subscription {
  return sub("on_window_event", tag, opts);
}

/** Subscribe to window open events. */
export function onWindowOpen(tag: string, opts?: SubOpts): Subscription {
  return sub("on_window_open", tag, opts);
}

/** Subscribe to window move events. */
export function onWindowMove(tag: string, opts?: SubOpts): Subscription {
  return sub("on_window_move", tag, opts);
}

/** Subscribe to keyboard modifier state changes (shift, ctrl, alt, etc.). */
export function onModifiersChanged(tag: string, opts?: SubOpts): Subscription {
  return sub("on_modifiers_changed", tag, opts);
}

/** Subscribe to any renderer event (catch-all). */
export function onEvent(tag: string, opts?: SubOpts): Subscription {
  return sub("on_event", tag, opts);
}

/** Set the maxRate on a subscription, returning a new subscription. */
export function maxRate(s: Subscription, rate: number): Subscription {
  return { ...s, maxRate: rate };
}

/**
 * Scope a list of subscriptions to a specific window.
 *
 * @example
 * ```ts
 * Subscription.forWindow("editor", [
 *   Subscription.onKeyPress("editor-keys"),
 *   Subscription.onMouseMove("editor-mouse", { maxRate: 60 }),
 * ])
 * ```
 */
export function forWindow(windowId: string, subs: Subscription[]): Subscription[] {
  return subs.map((s) => Object.freeze({ ...s, windowId }));
}

/** Validate and return a list of subscriptions. TypeScript's type system already validates element types. */
export function batch(subs: Subscription[]): Subscription[] {
  return subs;
}

/**
 * Unique key for diffing subscriptions.
 * Two subscriptions with the same key are considered identical.
 */
export function key(s: Subscription): string {
  const base = s.type === "every" ? `every:${String(s.interval)}:${s.tag}` : `${s.type}:${s.tag}`;
  return s.windowId ? `${base}@${s.windowId}` : base;
}

/**
 * Subscriptions: declarative event source registrations.
 *
 * Subscriptions tell the runtime which global events the app wants to
 * receive (keyboard, mouse, window lifecycle, animation frames, etc.).
 * The `subscribe()` callback returns a list of active subscriptions
 * each cycle. The runtime diffs this list, starting new subscriptions
 * and stopping removed ones automatically.
 *
 * Timer subscriptions carry a tag that becomes part of the event
 * struct. `update()` receives `{ kind: "timer", tag, timestamp }`.
 *
 * Renderer subscriptions (keyboard, pointer, window, etc.) take no
 * tag. Events arrive as typed event objects and are matched by
 * event kind. Renderer subs are keyed by `{type, windowId}` for
 * lifecycle diffing. Only one subscription of each kind per window
 * (or globally when no window is specified).
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
 *   const subs = [Sub.onWindowClose()]
 *   if (model.animating) {
 *     subs.push(Sub.onAnimationFrame({ maxRate: 60 }))
 *   }
 *   return subs
 * }
 * ```
 *
 * @module
 */

import type { Subscription } from "./types.js";

/** Common options for renderer subscription constructors. */
export interface SubOpts {
  readonly maxRate?: number;
  /** Scope this subscription to a specific window. */
  readonly window?: string;
}

function timerSub(tag: string, interval: number): Subscription {
  return Object.freeze({ type: "every", tag, interval });
}

function rendererSub(type: string, opts?: SubOpts): Subscription {
  const s: {
    type: string;
    tag: undefined;
    maxRate?: number;
    windowId?: string;
  } = { type, tag: undefined };
  if (opts?.maxRate !== undefined) s.maxRate = opts.maxRate;
  if (opts?.window !== undefined) s.windowId = opts.window;
  return Object.freeze(s);
}

/** Timer that fires every `intervalMs` milliseconds. */
export function every(intervalMs: number, tag: string): Subscription {
  return timerSub(tag, intervalMs);
}

/** Subscribe to key press events. */
export function onKeyPress(opts?: SubOpts): Subscription {
  return rendererSub("on_key_press", opts);
}

/** Subscribe to key release events. */
export function onKeyRelease(opts?: SubOpts): Subscription {
  return rendererSub("on_key_release", opts);
}

/** Subscribe to pointer move events (mouse cursor, touch, pen). */
export function onPointerMove(opts?: SubOpts): Subscription {
  return rendererSub("on_pointer_move", opts);
}

/** Subscribe to pointer button press/release events. */
export function onPointerButton(opts?: SubOpts): Subscription {
  return rendererSub("on_pointer_button", opts);
}

/** Subscribe to pointer scroll events. */
export function onPointerScroll(opts?: SubOpts): Subscription {
  return rendererSub("on_pointer_scroll", opts);
}

/** Subscribe to window close requests. */
export function onWindowClose(opts?: SubOpts): Subscription {
  return rendererSub("on_window_close", opts);
}

/** Subscribe to window resize events. */
export function onWindowResize(opts?: SubOpts): Subscription {
  return rendererSub("on_window_resize", opts);
}

/** Subscribe to window focus events. */
export function onWindowFocus(opts?: SubOpts): Subscription {
  return rendererSub("on_window_focus", opts);
}

/** Subscribe to window unfocus events. */
export function onWindowUnfocus(opts?: SubOpts): Subscription {
  return rendererSub("on_window_unfocus", opts);
}

/** Subscribe to animation frame events. */
export function onAnimationFrame(opts?: SubOpts): Subscription {
  return rendererSub("on_animation_frame", opts);
}

/** Subscribe to system theme changes. */
export function onThemeChange(opts?: SubOpts): Subscription {
  return rendererSub("on_theme_change", opts);
}

/** Subscribe to touch pointer events. */
export function onPointerTouch(opts?: SubOpts): Subscription {
  return rendererSub("on_pointer_touch", opts);
}

/** Subscribe to IME events. */
export function onIme(opts?: SubOpts): Subscription {
  return rendererSub("on_ime", opts);
}

/** Subscribe to file drop events. */
export function onFileDrop(opts?: SubOpts): Subscription {
  return rendererSub("on_file_drop", opts);
}

/** Subscribe to general window events (resize, move, focus, etc.). */
export function onWindowEvent(opts?: SubOpts): Subscription {
  return rendererSub("on_window_event", opts);
}

/** Subscribe to window open events. */
export function onWindowOpen(opts?: SubOpts): Subscription {
  return rendererSub("on_window_open", opts);
}

/** Subscribe to window move events. */
export function onWindowMove(opts?: SubOpts): Subscription {
  return rendererSub("on_window_move", opts);
}

/** Subscribe to keyboard modifier state changes (shift, ctrl, alt, etc.). */
export function onModifiersChanged(opts?: SubOpts): Subscription {
  return rendererSub("on_modifiers_changed", opts);
}

/** Subscribe to any renderer event (catch-all). */
export function onEvent(opts?: SubOpts): Subscription {
  return rendererSub("on_event", opts);
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
 *   Subscription.onKeyPress(),
 *   Subscription.onPointerMove({ maxRate: 60 }),
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
 *
 * Timer subscriptions are keyed by `every:interval:tag`.
 * Renderer subscriptions are keyed by `type:windowId`.
 * Widget-namespaced subscriptions (tag starts with `__cw:`) are keyed by `type:tag`.
 */
export function key(s: Subscription): string {
  if (s.type === "every") {
    return `every:${String(s.interval)}:${s.tag}`;
  }
  if (s.tag !== undefined) {
    return `${s.type}:${s.tag}`;
  }
  return `${s.type}:${s.windowId ?? ""}`;
}

/**
 * Derive the wire tag for a renderer subscription sent to the renderer.
 * Window-scoped subscriptions include the window_id to avoid collisions
 * with global subscriptions of the same kind.
 */
export function rendererWireTag(s: Subscription): string {
  if (s.windowId) {
    return `${s.type}:${s.windowId}`;
  }
  return s.type;
}

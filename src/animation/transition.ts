/**
 * Renderer-side timed transition descriptor.
 *
 * Declares animation intent in the view function. The renderer
 * handles interpolation locally with zero wire traffic during
 * animation.
 *
 * @example
 * ```tsx
 * import { transition, withAnimation } from 'plushie'
 *
 * // Fade in on mount
 * withAnimation(<Container id="item">...</Container>, {
 *   opacity: transition({ to: 1, from: 0, duration: 200 }),
 * })
 *
 * // Slide with easing
 * withAnimation(<Container id="panel">...</Container>, {
 *   translate_y: transition({ to: 0, duration: 300, easing: "ease_out" }),
 * })
 * ```
 *
 * @module
 */

import type { Easing } from "./easing.js";

/** Symbol marking animation descriptors for passthrough detection. */
export const ANIMATION_DESCRIPTOR: unique symbol = Symbol.for("plushie.animation_descriptor");

/** Options for creating a transition descriptor. */
export interface TransitionOpts {
  /** Target value the prop animates toward. */
  readonly to: unknown;
  /** Duration in milliseconds. */
  readonly duration: number;
  /** Easing curve name or cubic bezier. Defaults to "ease_in_out". */
  readonly easing?: Easing;
  /** Delay before the transition starts, in milliseconds. */
  readonly delay?: number;
  /** Starting value on mount (enter animation). Ignored after first render. */
  readonly from?: unknown;
  /** Number of times to repeat, or "forever" for infinite looping. */
  readonly repeat?: number | "forever";
  /** Whether to reverse on each repeat cycle. Defaults to true for loops. */
  readonly autoReverse?: boolean;
  /** Tag for the transition_complete event when the animation finishes. */
  readonly onComplete?: string;
}

/** A frozen transition descriptor sent as a prop value on the wire. */
export interface TransitionDescriptor {
  readonly [ANIMATION_DESCRIPTOR]: true;
  readonly type: "transition";
  readonly to: unknown;
  readonly duration: number;
  readonly easing: Easing;
  readonly delay: number;
  readonly from?: unknown;
  readonly repeat?: number | "forever";
  readonly auto_reverse?: boolean;
  readonly on_complete?: string;
}

/** Create a timed transition descriptor. */
export function transition(opts: TransitionOpts): TransitionDescriptor {
  const base = {
    [ANIMATION_DESCRIPTOR]: true as const,
    type: "transition" as const,
    to: opts.to,
    duration: opts.duration,
    easing: opts.easing ?? ("ease_in_out" as Easing),
    delay: opts.delay ?? 0,
  };
  const optional: Record<string, unknown> = {};
  if (opts.from !== undefined) optional["from"] = opts.from;
  if (opts.repeat !== undefined) optional["repeat"] = opts.repeat;
  if (opts.autoReverse !== undefined) optional["auto_reverse"] = opts.autoReverse;
  if (opts.onComplete !== undefined) optional["on_complete"] = opts.onComplete;
  return Object.freeze({ ...base, ...optional }) as TransitionDescriptor;
}

/**
 * Create a looping transition (repeats forever by default, auto-reverses).
 *
 * @example
 * ```ts
 * // Pulse forever
 * loop({ to: 0.4, from: 1, duration: 800 })
 *
 * // Finite: 3 cycles
 * loop({ to: 0.4, from: 1, duration: 800, repeat: 3 })
 *
 * // Spin forever (no reverse)
 * loop({ to: 360, from: 0, duration: 1000, reverse: false })
 * ```
 */
export function loop(opts: TransitionOpts & { readonly reverse?: boolean }): TransitionDescriptor {
  return transition({
    ...opts,
    repeat: opts.repeat ?? "forever",
    autoReverse: opts.reverse !== false,
  });
}

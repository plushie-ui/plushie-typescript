/**
 * Renderer-side sequential animation chain.
 *
 * Chains multiple transitions and springs that execute one after
 * another on the same prop. Each step's `from` defaults to the
 * previous step's final value if not specified.
 *
 * @example
 * ```tsx
 * import { sequence, transition, loop, withAnimation } from 'plushie'
 *
 * withAnimation(<Container id="item">...</Container>, {
 *   opacity: sequence({
 *     steps: [
 *       transition({ to: 1, from: 0, duration: 200 }),
 *       loop({ to: 0.7, from: 1, duration: 800, repeat: 3 }),
 *       transition({ to: 0, duration: 300 }),
 *     ],
 *     onComplete: "fade-cycle-done",
 *   }),
 * })
 * ```
 *
 * @module
 */

import type { SpringDescriptor } from "./spring.js";
import type { TransitionDescriptor } from "./transition.js";
import { ANIMATION_DESCRIPTOR } from "./transition.js";

/** A step in a sequence: either a transition or a spring. */
export type SequenceStep = TransitionDescriptor | SpringDescriptor;

/** Options for creating a sequence descriptor. */
export interface SequenceOpts {
  /** Ordered list of transition/spring steps. */
  readonly steps: readonly SequenceStep[];
  /** Tag for the transition_complete event when the entire sequence finishes. */
  readonly onComplete?: string;
}

/** A frozen sequence descriptor sent as a prop value on the wire. */
export interface SequenceDescriptor {
  readonly [ANIMATION_DESCRIPTOR]: true;
  readonly type: "sequence";
  readonly steps: readonly SequenceStep[];
  readonly on_complete?: string;
}

/** Create a sequential animation chain. */
export function sequence(opts: SequenceOpts): SequenceDescriptor {
  const base = {
    [ANIMATION_DESCRIPTOR]: true as const,
    type: "sequence" as const,
    steps: opts.steps,
  };
  const optional: Record<string, unknown> = {};
  if (opts.onComplete !== undefined) optional["on_complete"] = opts.onComplete;
  return Object.freeze({ ...base, ...optional }) as SequenceDescriptor;
}

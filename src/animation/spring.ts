/**
 * Renderer-side physics-based spring descriptor.
 *
 * Springs animate using a damped harmonic oscillator simulation.
 * Unlike timed transitions, springs have no fixed duration: they
 * settle naturally based on stiffness, damping, and mass. This
 * makes them ideal for interactive animations where the target
 * changes frequently (drag, scroll, hover) because interruption
 * preserves velocity for smooth redirection.
 *
 * @example
 * ```tsx
 * import { spring, withAnimation } from 'plushie'
 *
 * withAnimation(<Container id="card">...</Container>, {
 *   scale: spring({ to: 1.05, preset: "bouncy" }),
 * })
 * ```
 *
 * @module
 */

import { ANIMATION_DESCRIPTOR } from "./transition.js";

/** Named spring presets. */
export type SpringPreset = "gentle" | "bouncy" | "stiff" | "snappy" | "molasses";

const PRESETS: Record<SpringPreset, { stiffness: number; damping: number }> = {
  gentle: { stiffness: 120, damping: 14 },
  bouncy: { stiffness: 300, damping: 10 },
  stiff: { stiffness: 400, damping: 30 },
  snappy: { stiffness: 200, damping: 20 },
  molasses: { stiffness: 60, damping: 12 },
};

/** Options for creating a spring descriptor. */
export interface SpringOpts {
  /** Target value the prop animates toward. */
  readonly to: unknown;
  /** Starting value on mount (enter animation). */
  readonly from?: unknown;
  /** Spring stiffness (force constant). Higher = faster. Default: 100. */
  readonly stiffness?: number;
  /** Damping ratio. Higher = less oscillation. Default: 10. */
  readonly damping?: number;
  /** Mass of the spring. Higher = slower, more momentum. Default: 1. */
  readonly mass?: number;
  /** Initial velocity. Useful for gesture-driven animations. Default: 0. */
  readonly velocity?: number;
  /** Named preset that sets stiffness and damping. */
  readonly preset?: SpringPreset;
  /** Tag for the transition_complete event when the spring settles. */
  readonly onComplete?: string;
}

/** A frozen spring descriptor sent as a prop value on the wire. */
export interface SpringDescriptor {
  readonly [ANIMATION_DESCRIPTOR]: true;
  readonly type: "spring";
  readonly to: unknown;
  readonly from?: unknown;
  readonly stiffness: number;
  readonly damping: number;
  readonly mass: number;
  readonly velocity: number;
  readonly on_complete?: string;
}

/** Create a physics-based spring descriptor. */
export function spring(opts: SpringOpts): SpringDescriptor {
  const preset = opts.preset ? PRESETS[opts.preset] : undefined;
  const stiffness = opts.stiffness ?? preset?.stiffness ?? 100;
  const damping = opts.damping ?? preset?.damping ?? 10;
  const mass = opts.mass ?? 1;
  if (typeof stiffness !== "number" || stiffness <= 0 || !Number.isFinite(stiffness)) {
    throw new Error(`spring: stiffness must be a positive finite number, got ${String(stiffness)}`);
  }
  if (typeof damping !== "number" || damping < 0 || !Number.isFinite(damping)) {
    throw new Error(`spring: damping must be a non-negative finite number, got ${String(damping)}`);
  }
  if (typeof mass !== "number" || mass <= 0 || !Number.isFinite(mass)) {
    throw new Error(`spring: mass must be a positive finite number, got ${String(mass)}`);
  }
  const base = {
    [ANIMATION_DESCRIPTOR]: true as const,
    type: "spring" as const,
    to: opts.to,
    stiffness,
    damping,
    mass,
    velocity: opts.velocity ?? 0,
  };
  const optional: Record<string, unknown> = {};
  if (opts.from !== undefined) optional["from"] = opts.from;
  if (opts.onComplete !== undefined) optional["on_complete"] = opts.onComplete;
  return Object.freeze({ ...base, ...optional }) as SpringDescriptor;
}

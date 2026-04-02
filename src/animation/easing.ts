/**
 * Named easing curves for renderer-side transitions.
 *
 * Each name maps to a mathematical curve implemented by the renderer.
 * Pass these as the `easing` parameter to `transition()`.
 *
 * @module
 */

/** Named easing curve identifiers accepted by the renderer. */
export type EasingName =
  | "linear"
  | "ease_in"
  | "ease_out"
  | "ease_in_out"
  | "ease_in_quad"
  | "ease_out_quad"
  | "ease_in_out_quad"
  | "ease_in_cubic"
  | "ease_out_cubic"
  | "ease_in_out_cubic"
  | "ease_in_quart"
  | "ease_out_quart"
  | "ease_in_out_quart"
  | "ease_in_quint"
  | "ease_out_quint"
  | "ease_in_out_quint"
  | "ease_in_expo"
  | "ease_out_expo"
  | "ease_in_out_expo"
  | "ease_in_circ"
  | "ease_out_circ"
  | "ease_in_out_circ"
  | "ease_in_back"
  | "ease_out_back"
  | "ease_in_out_back"
  | "ease_in_elastic"
  | "ease_out_elastic"
  | "ease_in_out_elastic"
  | "ease_in_bounce"
  | "ease_out_bounce"
  | "ease_in_out_bounce";

/**
 * Cubic bezier easing. The four control points define the curve
 * shape, matching CSS `cubic-bezier(x1, y1, x2, y2)`.
 */
export interface CubicBezier {
  readonly cubic_bezier: readonly [number, number, number, number];
}

/** An easing value: either a named curve or a cubic bezier specification. */
export type Easing = EasingName | CubicBezier;

/** Create a cubic bezier easing specification. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): CubicBezier {
  return Object.freeze({ cubic_bezier: Object.freeze([x1, y1, x2, y2] as const) });
}

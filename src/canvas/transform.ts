/**
 * Transform values and clip rects for canvas groups.
 *
 * Transforms are value objects stored in a group's `transforms` array.
 * Clips are rectangles stored in the group's `clip` field.
 */

/** A transform value for a group's transforms array. */
export type TransformValue =
  | { readonly type: "translate"; readonly x: number; readonly y: number }
  | { readonly type: "rotate"; readonly angle: number }
  | { readonly type: "scale"; readonly x: number; readonly y: number };

/** A clip rectangle in local coordinates. */
export interface ClipRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Translate the coordinate origin. */
export function translate(x: number, y: number): TransformValue {
  return { type: "translate", x, y };
}

/** Rotate the coordinate system (angle in radians). */
export function rotate(angle: number): TransformValue {
  return { type: "rotate", angle };
}

/** Scale the coordinate system. If y is omitted, scales uniformly. */
export function scale(x: number, y?: number): TransformValue {
  return { type: "scale", x, y: y ?? x };
}

/** Uniform scale (same factor for both axes). */
export function scaleUniform(factor: number): TransformValue {
  return { type: "scale", x: factor, y: factor };
}

/** Create a clip rectangle in local coordinates. */
export function clip(x: number, y: number, w: number, h: number): ClipRect {
  return { x, y, w, h };
}

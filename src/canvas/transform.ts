/**
 * Transform values and clip rects for canvas groups.
 *
 * Transforms are value objects stored in a group's `transforms` array.
 * Clips are rectangles stored in the group's `clip` field.
 */

import { coordinate, extent } from "./geometry.js";

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
  return { type: "translate", x: coordinate(x), y: coordinate(y) };
}

/** Rotate the coordinate system (angle in degrees). */
export function rotate(angle: number): TransformValue {
  return { type: "rotate", angle: coordinate(angle) };
}

/** Scale the coordinate system. If y is omitted, scales uniformly. */
export function scale(x: number, y?: number): TransformValue {
  const normalizedX = coordinate(x);
  return { type: "scale", x: normalizedX, y: y === undefined ? normalizedX : coordinate(y) };
}

/** Uniform scale (same factor for both axes). */
export function scaleUniform(factor: number): TransformValue {
  const normalized = coordinate(factor);
  return { type: "scale", x: normalized, y: normalized };
}

/** Create a clip rectangle in local coordinates. */
export function clip(x: number, y: number, w: number, h: number): ClipRect {
  return normalizeClipRect({ x, y, w, h });
}

export function normalizeTransformValue(transform: TransformValue): TransformValue {
  switch (transform.type) {
    case "translate":
      return translate(transform.x, transform.y);
    case "rotate":
      return rotate(transform.angle);
    case "scale":
      return scale(transform.x, transform.y);
  }
}

export function normalizeClipRect(rect: ClipRect): ClipRect {
  return { x: coordinate(rect.x), y: coordinate(rect.y), w: extent(rect.w), h: extent(rect.h) };
}

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

/** Convert degrees to radians. */
export function degToRad(degrees: number): number {
  return degrees * DEG_TO_RAD;
}

/** Convert radians to degrees. */
export function radToDeg(radians: number): number {
  return radians * RAD_TO_DEG;
}

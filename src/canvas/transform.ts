/**
 * Transform and clip commands for canvas layers.
 *
 * These are interleaved with shapes in a layer's shape list:
 * ```ts
 * [pushTransform(), translate(100, 100), rotate(Math.PI / 4), rect(...), popTransform()]
 * ```
 */

export interface TransformCommand {
  readonly type: string
  readonly [key: string]: unknown
}

/** Push (save) the current transform state onto the stack. */
export function pushTransform(): TransformCommand {
  return { type: "push_transform" }
}

/** Pop (restore) the previously saved transform state from the stack. */
export function popTransform(): TransformCommand {
  return { type: "pop_transform" }
}

/** Translate the coordinate origin. */
export function translate(x: number, y: number): TransformCommand {
  return { type: "translate", x, y }
}

/** Rotate the coordinate system (angle in radians). */
export function rotate(angle: number): TransformCommand {
  return { type: "rotate", angle }
}

/** Scale the coordinate system. If y is omitted, scales uniformly. */
export function scale(x: number, y?: number): TransformCommand {
  return { type: "scale", x, y: y ?? x }
}

/** Push a clipping rectangle. Shapes until popClip are clipped to this region. */
export function pushClip(x: number, y: number, w: number, h: number): TransformCommand {
  return { type: "push_clip", x, y, w, h }
}

/** Pop the most recent clipping rectangle. */
export function popClip(): TransformCommand {
  return { type: "pop_clip" }
}

/**
 * Stroke descriptor for canvas shapes.
 *
 * Wire format:
 * ```json
 * {"color": "#000000", "width": 2, "cap": "round", "join": "miter", "dash": {"segments": [5, 3], "offset": 0}}
 * ```
 */

export interface Dash {
  readonly segments: readonly number[]
  readonly offset: number
}

export interface Stroke {
  readonly color: string
  readonly width: number
  readonly cap?: "butt" | "round" | "square"
  readonly join?: "miter" | "round" | "bevel"
  readonly dash?: Dash
}

export interface StrokeOpts {
  readonly cap?: "butt" | "round" | "square"
  readonly join?: "miter" | "round" | "bevel"
  readonly dash?: Dash
}

/** Builds a stroke descriptor. */
export function stroke(color: string, width: number, opts?: StrokeOpts): Stroke {
  const result: Record<string, unknown> = { color, width }
  if (opts?.cap !== undefined) result["cap"] = opts.cap
  if (opts?.join !== undefined) result["join"] = opts.join
  if (opts?.dash !== undefined) result["dash"] = opts.dash
  return result as unknown as Stroke
}

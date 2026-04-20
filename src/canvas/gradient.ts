/**
 * Canvas gradient builders.
 *
 * Wire format:
 * ```json
 * {"type": "linear", "start": [0, 0], "end": [200, 0], "stops": [[0.0, "#ff0000"], [1.0, "#0000ff"]]}
 * ```
 */

export interface LinearGradient {
  readonly type: "linear";
  readonly start: readonly [number, number];
  readonly end: readonly [number, number];
  readonly stops: readonly (readonly [number, string])[];
}

/** Builds a linear gradient usable as a fill value. */
export function linearGradient(
  from: readonly [number, number],
  to: readonly [number, number],
  stops: readonly (readonly [number, string])[],
): LinearGradient {
  return {
    type: "linear",
    start: from,
    end: to,
    stops,
  };
}

/**
 * Builds a linear gradient from an angle in degrees and a list of color stops.
 *
 * Angle convention (shared with every other plushie SDK):
 * 0 = east, 90 = south, 180 = west, 270 = north. The start and end
 * points are computed so the gradient axis passes through the unit
 * square centered at (0.5, 0.5).
 */
export function linearGradientFromAngle(
  angleDegrees: number,
  stops: readonly (readonly [number, string])[],
): LinearGradient {
  const radians = (angleDegrees * Math.PI) / 180;
  const dx = Math.cos(radians);
  const dy = Math.sin(radians);
  const halfLen = Math.abs(dx) / 2 + Math.abs(dy) / 2;
  const start: readonly [number, number] = [0.5 - dx * halfLen, 0.5 - dy * halfLen];
  const end: readonly [number, number] = [0.5 + dx * halfLen, 0.5 + dy * halfLen];
  return linearGradient(start, end, stops);
}

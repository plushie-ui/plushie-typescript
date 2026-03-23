/**
 * Canvas gradient builders.
 *
 * Wire format:
 * ```json
 * {"type": "linear", "start": [0, 0], "end": [200, 0], "stops": [[0.0, "#ff0000"], [1.0, "#0000ff"]]}
 * ```
 */

export interface GradientStop {
  readonly offset: number;
  readonly color: string;
}

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
  stops: readonly GradientStop[],
): LinearGradient {
  return {
    type: "linear",
    start: from,
    end: to,
    stops: stops.map((s) => [s.offset, s.color] as const),
  };
}

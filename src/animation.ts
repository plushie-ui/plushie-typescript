// -- Easing functions -----------------------------------------------------

/** Linear easing (identity). */
export function linear(t: number): number {
  return t
}

/** Cubic ease in. Starts slow, accelerates. */
export function easeIn(t: number): number {
  return t * t * t
}

/** Cubic ease out. Starts fast, decelerates. */
export function easeOut(t: number): number {
  const inv = 1 - t
  return 1 - inv * inv * inv
}

/** Cubic ease in-out. Slow start, fast middle, slow end. */
export function easeInOut(t: number): number {
  if (t < 0.5) return 4 * t * t * t
  const inv = -2 * t + 2
  return 1 - (inv * inv * inv) / 2
}

/** Quadratic ease in. */
export function easeInQuad(t: number): number {
  return t * t
}

/** Quadratic ease out. */
export function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t)
}

/** Quadratic ease in-out. */
export function easeInOutQuad(t: number): number {
  if (t < 0.5) return 2 * t * t
  return 1 - Math.pow(-2 * t + 2, 2) / 2
}

/** Spring easing with overshoot. Damped sine approximation. */
export function spring(t: number): number {
  if (t === 0) return 0
  if (t === 1) return 1
  const c4 = (2 * Math.PI) / 3
  return Math.pow(2, -10 * t) * Math.sin((10 * t - 0.75) * c4) + 1
}

// -- Types ----------------------------------------------------------------

export type EasingFn = (t: number) => number

export interface Animation {
  readonly from: number
  readonly to: number
  readonly duration: number
  readonly startedAt: number | null
  readonly easing: EasingFn
  readonly value: number
}

export interface AdvanceResult {
  readonly value: number
  readonly finished: boolean
}

// -- Helpers --------------------------------------------------------------

function clamp(t: number): number {
  if (t < 0) return 0
  if (t > 1) return 1
  return t
}

// -- Interpolation --------------------------------------------------------

/** Lerp between from and to at progress t, with optional easing. t is clamped 0..1. */
export function interpolate(
  from: number,
  to: number,
  t: number,
  easing: EasingFn = linear,
): number {
  const clamped = clamp(t)
  const eased = easing(clamped)
  return from + (to - from) * eased
}

// -- Animation lifecycle --------------------------------------------------

/** Create a new animation. */
export function createAnimation(
  from: number,
  to: number,
  durationMs: number,
  opts: { easing?: EasingFn } = {},
): Animation {
  return {
    from,
    to,
    duration: durationMs,
    startedAt: null,
    easing: opts.easing ?? linear,
    value: from,
  }
}

/** Start (or restart) the animation at the given timestamp. */
export function startAnimation(anim: Animation, timestamp: number): Animation {
  return { ...anim, startedAt: timestamp, value: anim.from }
}

/** Advance the animation to the given timestamp. */
export function advanceAnimation(anim: Animation, timestamp: number): AdvanceResult & { animation: Animation } {
  if (anim.startedAt === null) {
    return { value: anim.value, finished: false, animation: anim }
  }

  const elapsed = timestamp - anim.startedAt
  const t = clamp(elapsed / anim.duration)
  const current = interpolate(anim.from, anim.to, t, anim.easing)

  if (t >= 1) {
    return {
      value: anim.to,
      finished: true,
      animation: { ...anim, value: anim.to },
    }
  }

  return {
    value: current,
    finished: false,
    animation: { ...anim, value: current },
  }
}

/** Return the current interpolated value. */
export function animationValue(anim: Animation): number {
  return anim.value
}

/** Return true if the animation has run to completion. */
export function animationFinished(anim: Animation): boolean {
  if (anim.startedAt === null) return false
  return anim.value === anim.to
}

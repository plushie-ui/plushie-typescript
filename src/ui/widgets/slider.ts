/**
 * Slider widget -- horizontal range input.
 *
 * @module
 */

import type { UINode, Handler } from "../../types.js"
import type { Length, Color, StyleMap, A11y } from "../types.js"
import { encodeLength, encodeColor, encodeStyleMap, encodeA11y } from "../types.js"
import { leafNode, putIf, autoId, extractHandlers } from "../build.js"

const SLIDER_HANDLERS = {
  onSlide: "slide",
  onSlideRelease: "slide_release",
} as const

/** Props for the Slider widget. */
export interface SliderProps {
  id?: string
  value: number
  range: [number, number]
  step?: number
  shiftStep?: number
  default?: number
  width?: Length
  height?: number
  circularHandle?: boolean
  handleRadius?: number
  railColor?: Color
  railWidth?: number
  style?: StyleMap
  /** Accessible label (e.g., "Volume"). */
  label?: string
  a11y?: A11y
  eventRate?: number
  /** Called continuously while sliding. */
  onSlide?: Handler<unknown>
  /** Called when the slider is released. */
  onSlideRelease?: Handler<unknown>
}

/**
 * Slider JSX component.
 *
 * ```tsx
 * <Slider id="volume" value={state.volume} range={[0, 100]}
 *   step={1} onSlide={handleVolume} label="Volume" />
 * ```
 */
export function Slider(props: SliderProps): UINode {
  const id = props.id ?? autoId("slider")
  const clean = extractHandlers(id, props, SLIDER_HANDLERS)
  const p: Record<string, unknown> = {
    value: clean.value,
    range: clean.range,
  }
  putIf(p, clean.step, "step")
  putIf(p, clean.shiftStep, "shift_step")
  putIf(p, clean.default, "default")
  putIf(p, clean.width, "width", encodeLength)
  putIf(p, clean.height, "height")
  putIf(p, clean.circularHandle, "circular_handle")
  putIf(p, clean.handleRadius, "handle_radius")
  putIf(p, clean.railColor, "rail_color", encodeColor)
  putIf(p, clean.railWidth, "rail_width")
  putIf(p, clean.style, "style", encodeStyleMap)
  putIf(p, clean.label, "label")
  putIf(p, clean.a11y, "a11y", encodeA11y)
  putIf(p, clean.eventRate, "event_rate")
  return leafNode(id, "slider", p)
}

/**
 * Slider function API.
 *
 * ```ts
 * slider("volume", 50, [0, 100], { step: 1, onSlide: handler })
 * ```
 */
export function slider(
  id: string,
  value: number,
  range: [number, number],
  opts?: Omit<SliderProps, "id" | "value" | "range">,
): UINode {
  return Slider({ id, value, range, ...opts })
}

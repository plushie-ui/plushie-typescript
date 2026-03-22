/**
 * Vertical slider -- vertical range input.
 *
 * @module
 */

import type { UINode, Handler } from "../../types.js"
import type { Length, Color, StyleMap, A11y } from "../types.js"
import { encodeLength, encodeColor, encodeStyleMap, encodeA11y } from "../types.js"
import { leafNode, putIf, autoId, extractHandlers } from "../build.js"

const VSLIDER_HANDLERS = {
  onSlide: "slide",
  onSlideRelease: "slide_release",
} as const

/** Props for the VerticalSlider widget. */
export interface VerticalSliderProps {
  id?: string
  value: number
  range: [number, number]
  step?: number
  shiftStep?: number
  default?: number
  width?: Length
  height?: Length
  railColor?: Color
  railWidth?: number
  style?: StyleMap
  label?: string
  a11y?: A11y
  eventRate?: number
  onSlide?: Handler<unknown>
  onSlideRelease?: Handler<unknown>
}

export function VerticalSlider(props: VerticalSliderProps): UINode {
  const id = props.id ?? autoId("vertical_slider")
  const clean = extractHandlers(id, props, VSLIDER_HANDLERS)
  const p: Record<string, unknown> = {
    value: clean.value,
    range: clean.range,
  }
  putIf(p, clean.step, "step")
  putIf(p, clean.shiftStep, "shift_step")
  putIf(p, clean.default, "default")
  putIf(p, clean.width, "width", encodeLength)
  putIf(p, clean.height, "height", encodeLength)
  putIf(p, clean.railColor, "rail_color", encodeColor)
  putIf(p, clean.railWidth, "rail_width")
  putIf(p, clean.style, "style", encodeStyleMap)
  putIf(p, clean.label, "label")
  putIf(p, clean.a11y, "a11y", encodeA11y)
  putIf(p, clean.eventRate, "event_rate")
  return leafNode(id, "vertical_slider", p)
}

export function verticalSlider(
  id: string,
  value: number,
  range: [number, number],
  opts?: Omit<VerticalSliderProps, "id" | "value" | "range">,
): UINode {
  return VerticalSlider({ id, value, range, ...opts })
}

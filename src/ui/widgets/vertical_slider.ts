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
  /** Unique widget identifier. */
  id?: string
  /** Current slider value. */
  value: number
  /** Min and max values as [min, max]. */
  range: [number, number]
  /** Increment step when dragging. */
  step?: number
  /** Larger step when holding Shift while dragging. */
  shiftStep?: number
  /** Value to reset to on double-click. */
  default?: number
  /** Width of the slider. */
  width?: Length
  /** Height of the slider track. */
  height?: Length
  /** Color of the track rail. */
  railColor?: Color
  /** Thickness of the track rail in pixels. */
  railWidth?: number
  /** Style preset name or StyleMap overrides. */
  style?: StyleMap
  /** Accessible label announced by screen readers (e.g., "Volume"). */
  label?: string
  /** Accessibility properties. */
  a11y?: A11y
  /** Maximum events per second for this widget's coalescable events. */
  eventRate?: number
  /** Called continuously while sliding. */
  onSlide?: Handler<unknown>
  /** Called when the slider is released. */
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

/**
 * Toggler widget -- on/off switch.
 *
 * @module
 */

import type { UINode, Handler } from "../../types.js"
import type {
  Length, Font, Wrapping, Shaping, LineHeight, Alignment, StyleMap, A11y,
} from "../types.js"
import {
  encodeLength, encodeFont, encodeLineHeight, encodeAlignment,
  encodeStyleMap, encodeA11y,
} from "../types.js"
import { leafNode, putIf, autoId, extractHandlers } from "../build.js"

const TOGGLER_HANDLERS = { onToggle: "toggle" } as const

/** Props for the Toggler widget. */
export interface TogglerProps {
  id?: string
  value: boolean
  label?: string
  spacing?: number
  width?: Length
  size?: number
  textSize?: number
  font?: Font
  lineHeight?: LineHeight
  shaping?: Shaping
  wrapping?: Wrapping
  textAlignment?: Alignment
  style?: StyleMap
  disabled?: boolean
  a11y?: A11y
  eventRate?: number
  onToggle?: Handler<unknown>
  children?: string
}

export function Toggler(props: TogglerProps): UINode {
  const id = props.id ?? autoId("toggler")
  const label = props.children ?? props.label
  const clean = extractHandlers(id, props, TOGGLER_HANDLERS)
  const p: Record<string, unknown> = { is_toggled: clean.value }
  putIf(p, label, "label")
  putIf(p, clean.spacing, "spacing")
  putIf(p, clean.width, "width", encodeLength)
  putIf(p, clean.size, "size")
  putIf(p, clean.textSize, "text_size")
  putIf(p, clean.font, "font", encodeFont)
  putIf(p, clean.lineHeight, "line_height", encodeLineHeight)
  putIf(p, clean.shaping, "shaping")
  putIf(p, clean.wrapping, "wrapping")
  putIf(p, clean.textAlignment, "text_alignment", encodeAlignment)
  putIf(p, clean.style, "style", encodeStyleMap)
  putIf(p, clean.disabled, "disabled")
  putIf(p, clean.a11y, "a11y", encodeA11y)
  putIf(p, clean.eventRate, "event_rate")
  return leafNode(id, "toggler", p)
}

export function toggler(
  id: string,
  value: boolean,
  opts?: Omit<TogglerProps, "id" | "value">,
): UINode {
  return Toggler({ id, value, ...opts })
}

/**
 * Radio button -- one-of-many selection.
 *
 * @module
 */

import type { UINode, Handler } from "../../types.js"
import type {
  Length, Font, Wrapping, Shaping, LineHeight, StyleMap, A11y,
} from "../types.js"
import {
  encodeLength, encodeFont, encodeLineHeight, encodeStyleMap, encodeA11y,
} from "../types.js"
import { leafNode, putIf, autoId, extractHandlers } from "../build.js"

const RADIO_HANDLERS = { onSelect: "select" } as const

/** Props for the Radio widget. */
export interface RadioProps {
  id?: string
  value: string
  selected?: string | null
  label?: string
  group?: string
  spacing?: number
  width?: Length
  size?: number
  textSize?: number
  font?: Font
  lineHeight?: LineHeight
  shaping?: Shaping
  wrapping?: Wrapping
  style?: StyleMap
  a11y?: A11y
  eventRate?: number
  onSelect?: Handler<unknown>
  children?: string
}

export function Radio(props: RadioProps): UINode {
  const id = props.id ?? autoId("radio")
  const label = props.children ?? props.label ?? props.value
  const clean = extractHandlers(id, props, RADIO_HANDLERS)
  const p: Record<string, unknown> = { value: clean.value, selected: clean.selected ?? null }
  putIf(p, label, "label")
  putIf(p, clean.group, "group")
  putIf(p, clean.spacing, "spacing")
  putIf(p, clean.width, "width", encodeLength)
  putIf(p, clean.size, "size")
  putIf(p, clean.textSize, "text_size")
  putIf(p, clean.font, "font", encodeFont)
  putIf(p, clean.lineHeight, "line_height", encodeLineHeight)
  putIf(p, clean.shaping, "shaping")
  putIf(p, clean.wrapping, "wrapping")
  putIf(p, clean.style, "style", encodeStyleMap)
  putIf(p, clean.a11y, "a11y", encodeA11y)
  putIf(p, clean.eventRate, "event_rate")
  return leafNode(id, "radio", p)
}

export function radio(
  id: string,
  value: string,
  selected: string | null,
  opts?: Omit<RadioProps, "id" | "value" | "selected">,
): UINode {
  return Radio({ id, value, selected, ...opts })
}

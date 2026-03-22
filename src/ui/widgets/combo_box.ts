/**
 * Combo box -- searchable dropdown with free-form text input.
 *
 * @module
 */

import type { UINode, Handler } from "../../types.js"
import type {
  Length, Padding, Font, Shaping, LineHeight, StyleMap, A11y,
} from "../types.js"
import {
  encodeLength, encodePadding, encodeFont, encodeLineHeight,
  encodeStyleMap, encodeA11y,
} from "../types.js"
import { leafNode, putIf, extractHandlers } from "../build.js"

const COMBO_BOX_HANDLERS = {
  onSelect: "select",
  onInput: "input",
  onOptionHovered: "option_hovered",
  onOpen: "open",
  onClose: "close",
} as const

/** Props for the ComboBox widget. */
export interface ComboBoxProps {
  id: string
  options: string[]
  selected?: string | null
  placeholder?: string
  width?: Length
  padding?: Padding
  size?: number
  font?: Font
  lineHeight?: LineHeight
  menuHeight?: number
  shaping?: Shaping
  icon?: Record<string, unknown>
  ellipsis?: string
  menuStyle?: Record<string, unknown>
  style?: StyleMap
  a11y?: A11y
  eventRate?: number
  onSelect?: Handler<unknown>
  onInput?: Handler<unknown>
  onOptionHovered?: Handler<unknown> | boolean
  onOpen?: Handler<unknown> | boolean
  onClose?: Handler<unknown> | boolean
}

export function ComboBox(props: ComboBoxProps): UINode {
  const { id } = props
  const handlerProps: Record<string, string> = {}
  if (typeof props.onSelect === "function") handlerProps["onSelect"] = "select"
  if (typeof props.onInput === "function") handlerProps["onInput"] = "input"
  if (typeof props.onOptionHovered === "function") handlerProps["onOptionHovered"] = "option_hovered"
  if (typeof props.onOpen === "function") handlerProps["onOpen"] = "open"
  if (typeof props.onClose === "function") handlerProps["onClose"] = "close"
  const clean = extractHandlers(id, props, handlerProps)

  const p: Record<string, unknown> = { options: clean.options }
  putIf(p, clean.selected, "selected")
  putIf(p, clean.placeholder, "placeholder")
  putIf(p, clean.width, "width", encodeLength)
  putIf(p, clean.padding, "padding", encodePadding)
  putIf(p, clean.size, "size")
  putIf(p, clean.font, "font", encodeFont)
  putIf(p, clean.lineHeight, "line_height", encodeLineHeight)
  putIf(p, clean.menuHeight, "menu_height")
  putIf(p, clean.shaping, "shaping")
  putIf(p, clean.icon, "icon")
  putIf(p, clean.ellipsis, "ellipsis")
  putIf(p, clean.menuStyle, "menu_style")
  putIf(p, clean.style, "style", encodeStyleMap)
  putIf(p, clean.a11y, "a11y", encodeA11y)
  putIf(p, clean.eventRate, "event_rate")
  if (typeof props.onOptionHovered === "boolean") putIf(p, props.onOptionHovered, "on_option_hovered")
  else if (typeof props.onOptionHovered === "function") p["on_option_hovered"] = true
  if (typeof props.onOpen === "boolean") putIf(p, props.onOpen, "on_open")
  else if (typeof props.onOpen === "function") p["on_open"] = true
  if (typeof props.onClose === "boolean") putIf(p, props.onClose, "on_close")
  else if (typeof props.onClose === "function") p["on_close"] = true
  return leafNode(id, "combo_box", p)
}

export function comboBox(
  id: string,
  options: string[],
  opts?: Omit<ComboBoxProps, "id" | "options">,
): UINode {
  return ComboBox({ id, options, ...opts })
}

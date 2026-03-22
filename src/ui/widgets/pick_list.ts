/**
 * Pick list -- dropdown selection.
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
import { leafNode, putIf, autoId, extractHandlers } from "../build.js"

const PICK_LIST_HANDLERS = {
  onSelect: "select",
  onOpen: "open",
  onClose: "close",
} as const

/** Props for the PickList widget. */
export interface PickListProps {
  id?: string
  options: string[]
  selected?: string | null
  placeholder?: string
  width?: Length
  padding?: Padding
  textSize?: number
  font?: Font
  lineHeight?: LineHeight
  menuHeight?: number
  shaping?: Shaping
  handle?: Record<string, unknown>
  ellipsis?: string
  menuStyle?: Record<string, unknown>
  style?: StyleMap
  a11y?: A11y
  eventRate?: number
  onSelect?: Handler<unknown>
  onOpen?: Handler<unknown> | boolean
  onClose?: Handler<unknown> | boolean
}

export function PickList(props: PickListProps): UINode {
  const id = props.id ?? autoId("pick_list")
  const handlerProps: Record<string, string> = {}
  if (typeof props.onSelect === "function") handlerProps["onSelect"] = "select"
  if (typeof props.onOpen === "function") handlerProps["onOpen"] = "open"
  if (typeof props.onClose === "function") handlerProps["onClose"] = "close"
  const clean = extractHandlers(id, props, handlerProps)

  const p: Record<string, unknown> = { options: clean.options }
  putIf(p, clean.selected, "selected")
  putIf(p, clean.placeholder, "placeholder")
  putIf(p, clean.width, "width", encodeLength)
  putIf(p, clean.padding, "padding", encodePadding)
  putIf(p, clean.textSize, "text_size")
  putIf(p, clean.font, "font", encodeFont)
  putIf(p, clean.lineHeight, "line_height", encodeLineHeight)
  putIf(p, clean.menuHeight, "menu_height")
  putIf(p, clean.shaping, "shaping")
  putIf(p, clean.handle, "handle")
  putIf(p, clean.ellipsis, "ellipsis")
  putIf(p, clean.menuStyle, "menu_style")
  putIf(p, clean.style, "style", encodeStyleMap)
  putIf(p, clean.a11y, "a11y", encodeA11y)
  putIf(p, clean.eventRate, "event_rate")
  if (typeof props.onOpen === "boolean") putIf(p, props.onOpen, "on_open")
  else if (typeof props.onOpen === "function") p["on_open"] = true
  if (typeof props.onClose === "boolean") putIf(p, props.onClose, "on_close")
  else if (typeof props.onClose === "function") p["on_close"] = true
  return leafNode(id, "pick_list", p)
}

export function pickList(
  id: string,
  options: string[],
  opts?: Omit<PickListProps, "id" | "options">,
): UINode {
  return PickList({ id, options, ...opts })
}

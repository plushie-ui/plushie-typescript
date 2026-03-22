/**
 * Scrollable container -- wraps child content in a scrollable viewport.
 *
 * @module
 */

import type { UINode, Handler } from "../../types.js"
import type { Length, Direction, Anchor, Color, A11y } from "../types.js"
import { encodeLength, encodeColor, encodeA11y } from "../types.js"
import { containerNode, putIf, autoId, extractHandlers } from "../build.js"

const SCROLLABLE_HANDLERS = { onScroll: "scroll" } as const

/** Props for the Scrollable widget. */
export interface ScrollableProps {
  id?: string
  width?: Length
  height?: Length
  direction?: Direction | "both"
  spacing?: number
  scrollbarWidth?: number
  scrollbarMargin?: number
  scrollerWidth?: number
  scrollbarColor?: Color
  scrollerColor?: Color
  anchor?: Anchor
  autoScroll?: boolean
  style?: string
  a11y?: A11y
  eventRate?: number
  onScroll?: Handler<unknown> | boolean
  children?: UINode[]
}

export function Scrollable(props: ScrollableProps): UINode {
  const id = props.id ?? autoId("scrollable")
  const children = props.children ?? []
  const handlerProps: Record<string, string> = {}
  if (typeof props.onScroll === "function") handlerProps["onScroll"] = "scroll"
  const clean = extractHandlers(id, props, handlerProps)

  const p: Record<string, unknown> = {}
  putIf(p, clean.width, "width", encodeLength)
  putIf(p, clean.height, "height", encodeLength)
  putIf(p, clean.direction, "direction")
  putIf(p, clean.spacing, "spacing")
  putIf(p, clean.scrollbarWidth, "scrollbar_width")
  putIf(p, clean.scrollbarMargin, "scrollbar_margin")
  putIf(p, clean.scrollerWidth, "scroller_width")
  putIf(p, clean.scrollbarColor, "scrollbar_color", encodeColor)
  putIf(p, clean.scrollerColor, "scroller_color", encodeColor)
  putIf(p, clean.anchor, "anchor")
  putIf(p, clean.autoScroll, "auto_scroll")
  putIf(p, clean.style, "style")
  putIf(p, clean.a11y, "a11y", encodeA11y)
  putIf(p, clean.eventRate, "event_rate")
  if (typeof props.onScroll === "boolean") putIf(p, props.onScroll, "on_scroll")
  else if (typeof props.onScroll === "function") p["on_scroll"] = true
  return containerNode(id, "scrollable", p, Array.isArray(children) ? children : [children])
}

export function scrollable(children: UINode[]): UINode
export function scrollable(opts: Omit<ScrollableProps, "children">, children: UINode[]): UINode
export function scrollable(
  first: UINode[] | Omit<ScrollableProps, "children">,
  second?: UINode[],
): UINode {
  if (Array.isArray(first)) {
    return Scrollable({ children: first })
  }
  return Scrollable({ ...first, children: second ?? [] })
}

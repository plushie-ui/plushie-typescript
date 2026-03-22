/**
 * Canvas -- drawing surface with shapes organized into layers.
 *
 * @module
 */

import type { UINode, Handler } from "../../types.js"
import type { Length, Color, A11y } from "../types.js"
import { encodeLength, encodeColor, encodeA11y } from "../types.js"
import { containerNode, putIf, autoId, extractHandlers } from "../build.js"

const CANVAS_HANDLERS = {
  onPress: "press",
  onRelease: "release",
  onMove: "move",
  onScroll: "scroll",
} as const

/** Props for the Canvas widget. */
export interface CanvasProps {
  id?: string
  width?: Length
  height?: Length
  background?: Color
  interactive?: boolean
  alt?: string
  description?: string
  a11y?: A11y
  eventRate?: number
  onPress?: Handler<unknown> | boolean
  onRelease?: Handler<unknown> | boolean
  onMove?: Handler<unknown> | boolean
  onScroll?: Handler<unknown> | boolean
  children?: UINode[]
}

export function Canvas(props: CanvasProps): UINode {
  const id = props.id ?? autoId("canvas")
  const children = props.children ?? []
  const handlerProps: Record<string, string> = {}
  for (const [key, wire] of Object.entries(CANVAS_HANDLERS)) {
    if (typeof (props as Record<string, unknown>)[key] === "function") {
      handlerProps[key] = wire
    }
  }
  const clean = extractHandlers(id, props, handlerProps)

  const p: Record<string, unknown> = {}
  putIf(p, clean.width, "width", encodeLength)
  putIf(p, clean.height, "height", encodeLength)
  putIf(p, clean.background, "background", encodeColor)
  putIf(p, clean.interactive, "interactive")
  putIf(p, clean.alt, "alt")
  putIf(p, clean.description, "description")
  putIf(p, clean.a11y, "a11y", encodeA11y)
  putIf(p, clean.eventRate, "event_rate")
  for (const [key, wire] of Object.entries(CANVAS_HANDLERS)) {
    const val = (props as Record<string, unknown>)[key]
    if (typeof val === "boolean") putIf(p, val, `on_${wire}`)
    else if (typeof val === "function") p[`on_${wire}`] = true
  }
  return containerNode(id, "canvas", p, Array.isArray(children) ? children : [children])
}

export function canvas(
  opts: Omit<CanvasProps, "children">,
  children: UINode[],
): UINode {
  return Canvas({ ...opts, children })
}

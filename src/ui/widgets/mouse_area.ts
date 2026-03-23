/**
 * Mouse area -- captures mouse events on child content.
 *
 * @module
 */

import type { UINode, Handler } from "../../types.js"
import type { A11y } from "../types.js"
import { encodeA11y } from "../types.js"
import { containerNode, putIf, autoId, extractHandlers } from "../build.js"

const MOUSE_AREA_HANDLERS = {
  onPress: "press",
  onRelease: "release",
  onRightPress: "right_press",
  onRightRelease: "right_release",
  onMiddlePress: "middle_press",
  onMiddleRelease: "middle_release",
  onDoubleClick: "double_click",
  onEnter: "enter",
  onExit: "exit",
  onMove: "move",
  onScroll: "scroll",
} as const

/** Props for the MouseArea widget. */
export interface MouseAreaProps {
  id?: string
  cursor?: string
  a11y?: A11y
  eventRate?: number
  onPress?: Handler<unknown> | boolean
  onRelease?: Handler<unknown> | boolean
  onRightPress?: Handler<unknown> | boolean
  onRightRelease?: Handler<unknown> | boolean
  onMiddlePress?: Handler<unknown> | boolean
  onMiddleRelease?: Handler<unknown> | boolean
  onDoubleClick?: Handler<unknown> | boolean
  onEnter?: Handler<unknown> | boolean
  onExit?: Handler<unknown> | boolean
  onMove?: Handler<unknown> | boolean
  onScroll?: Handler<unknown> | boolean
  children?: UINode[]
}

export function MouseArea(props: MouseAreaProps): UINode {
  const id = props.id ?? autoId("mouse_area")
  const children = props.children ?? []
  const handlerProps: Record<string, string> = {}
  for (const [key, wire] of Object.entries(MOUSE_AREA_HANDLERS)) {
    if (typeof (props as Record<string, unknown>)[key] === "function") {
      handlerProps[key] = wire
    }
  }
  const clean = extractHandlers(id, props, handlerProps)

  const p: Record<string, unknown> = {}
  putIf(p, clean.cursor, "cursor")
  putIf(p, clean.a11y, "a11y", encodeA11y)
  putIf(p, clean.eventRate, "event_rate")
  // Boolean flags for event enablement
  for (const [key, wire] of Object.entries(MOUSE_AREA_HANDLERS)) {
    const val = (props as Record<string, unknown>)[key]
    if (typeof val === "boolean") putIf(p, val, `on_${wire}`)
    else if (typeof val === "function") p[`on_${wire}`] = true
  }
  return containerNode(id, "mouse_area", p, Array.isArray(children) ? children : [children])
}

export function mouseArea(
  opts: Omit<MouseAreaProps, "children">,
  children: UINode[],
): UINode {
  return MouseArea({ ...opts, children })
}

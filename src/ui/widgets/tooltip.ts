/**
 * Tooltip -- shows a popup tip over child content on hover.
 *
 * @module
 */

import type { UINode } from "../../types.js"
import type { StyleMap, A11y } from "../types.js"
import { encodeStyleMap, encodeA11y } from "../types.js"
import { containerNode, putIf, autoId } from "../build.js"

/** Props for the Tooltip widget. */
export interface TooltipProps {
  id?: string
  tip: string
  position?: "top" | "bottom" | "left" | "right" | "follow_cursor"
  gap?: number
  padding?: number
  snapWithinViewport?: boolean
  delay?: number
  style?: StyleMap
  a11y?: A11y
  children?: UINode[]
}

export function Tooltip(props: TooltipProps): UINode {
  const id = props.id ?? autoId("tooltip")
  const children = props.children ?? []
  const p: Record<string, unknown> = { tip: props.tip }
  putIf(p, props.position, "position")
  putIf(p, props.gap, "gap")
  putIf(p, props.padding, "padding")
  putIf(p, props.snapWithinViewport, "snap_within_viewport")
  putIf(p, props.delay, "delay")
  putIf(p, props.style, "style", encodeStyleMap)
  putIf(p, props.a11y, "a11y", encodeA11y)
  return containerNode(id, "tooltip", p, Array.isArray(children) ? children : [children])
}

export function tooltip(
  tip: string,
  opts: Omit<TooltipProps, "tip" | "children">,
  children: UINode[],
): UINode {
  return Tooltip({ tip, ...opts, children })
}

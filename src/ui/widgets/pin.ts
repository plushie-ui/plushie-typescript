/**
 * Pin -- positions child at absolute coordinates within a Stack.
 *
 * @module
 */

import type { UINode } from "../../types.js"
import type { Length, A11y } from "../types.js"
import { encodeLength, encodeA11y } from "../types.js"
import { containerNode, putIf, autoId } from "../build.js"

/** Props for the Pin widget. */
export interface PinProps {
  id?: string
  x?: number
  y?: number
  width?: Length
  height?: Length
  a11y?: A11y
  children?: UINode[]
}

export function Pin(props: PinProps): UINode {
  const id = props.id ?? autoId("pin")
  const children = props.children ?? []
  const p: Record<string, unknown> = {}
  putIf(p, props.x, "x")
  putIf(p, props.y, "y")
  putIf(p, props.width, "width", encodeLength)
  putIf(p, props.height, "height", encodeLength)
  putIf(p, props.a11y, "a11y", encodeA11y)
  return containerNode(id, "pin", p, Array.isArray(children) ? children : [children])
}

export function pin(opts: Omit<PinProps, "children">, children: UINode[]): UINode {
  return Pin({ ...opts, children })
}

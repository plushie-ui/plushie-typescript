/**
 * Stack -- overlays children on top of each other.
 *
 * @module
 */

import type { UINode } from "../../types.js"
import type { Length, A11y } from "../types.js"
import { encodeLength, encodeA11y } from "../types.js"
import { containerNode, putIf, autoId } from "../build.js"

/** Props for the Stack widget. */
export interface StackProps {
  id?: string
  width?: Length
  height?: Length
  clip?: boolean
  a11y?: A11y
  children?: UINode[]
}

export function Stack(props: StackProps): UINode {
  const id = props.id ?? autoId("stack")
  const children = props.children ?? []
  const p: Record<string, unknown> = {}
  putIf(p, props.width, "width", encodeLength)
  putIf(p, props.height, "height", encodeLength)
  putIf(p, props.clip, "clip")
  putIf(p, props.a11y, "a11y", encodeA11y)
  return containerNode(id, "stack", p, Array.isArray(children) ? children : [children])
}

export function stack(children: UINode[]): UINode
export function stack(opts: Omit<StackProps, "children">, children: UINode[]): UINode
export function stack(
  first: UINode[] | Omit<StackProps, "children">,
  second?: UINode[],
): UINode {
  if (Array.isArray(first)) {
    return Stack({ children: first })
  }
  return Stack({ ...first, children: second ?? [] })
}

/**
 * Responsive container -- adapts layout based on available space.
 *
 * @module
 */

import type { UINode } from "../../types.js"
import type { Length, A11y } from "../types.js"
import { encodeLength, encodeA11y } from "../types.js"
import { containerNode, putIf, autoId } from "../build.js"

/** Props for the Responsive widget. */
export interface ResponsiveProps {
  /** Unique widget identifier. */
  id?: string
  /** Width of the responsive container. */
  width?: Length
  /** Height of the responsive container. */
  height?: Length
  /** Accessibility properties. */
  a11y?: A11y
  /** Child widgets that adapt to available space. */
  children?: UINode[]
}

export function Responsive(props: ResponsiveProps): UINode {
  const id = props.id ?? autoId("responsive")
  const children = props.children ?? []
  const p: Record<string, unknown> = {}
  putIf(p, props.width, "width", encodeLength)
  putIf(p, props.height, "height", encodeLength)
  putIf(p, props.a11y, "a11y", encodeA11y)
  return containerNode(id, "responsive", p, Array.isArray(children) ? children : [children])
}

export function responsive(children: UINode[]): UINode
export function responsive(opts: Omit<ResponsiveProps, "children">, children: UINode[]): UINode
export function responsive(
  first: UINode[] | Omit<ResponsiveProps, "children">,
  second?: UINode[],
): UINode {
  if (Array.isArray(first)) {
    return Responsive({ children: first })
  }
  return Responsive({ ...first, children: second ?? [] })
}

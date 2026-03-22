/**
 * Keyed column -- like Column but children are keyed for efficient diffing.
 *
 * @module
 */

import type { UINode } from "../../types.js"
import type { Length, Padding, A11y } from "../types.js"
import { encodeLength, encodePadding, encodeA11y } from "../types.js"
import { containerNode, putIf, autoId } from "../build.js"

/** Props for the KeyedColumn widget. */
export interface KeyedColumnProps {
  id?: string
  spacing?: number
  padding?: Padding
  width?: Length
  height?: Length
  maxWidth?: number
  a11y?: A11y
  children?: UINode[]
}

export function KeyedColumn(props: KeyedColumnProps): UINode {
  const id = props.id ?? autoId("keyed_column")
  const children = props.children ?? []
  const p: Record<string, unknown> = {}
  putIf(p, props.spacing, "spacing")
  putIf(p, props.padding, "padding", encodePadding)
  putIf(p, props.width, "width", encodeLength)
  putIf(p, props.height, "height", encodeLength)
  putIf(p, props.maxWidth, "max_width")
  putIf(p, props.a11y, "a11y", encodeA11y)
  return containerNode(id, "keyed_column", p, Array.isArray(children) ? children : [children])
}

export function keyedColumn(children: UINode[]): UINode
export function keyedColumn(opts: Omit<KeyedColumnProps, "children">, children: UINode[]): UINode
export function keyedColumn(
  first: UINode[] | Omit<KeyedColumnProps, "children">,
  second?: UINode[],
): UINode {
  if (Array.isArray(first)) {
    return KeyedColumn({ children: first })
  }
  return KeyedColumn({ ...first, children: second ?? [] })
}

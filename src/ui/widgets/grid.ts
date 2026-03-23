/**
 * Grid layout -- arranges children in a grid.
 *
 * @module
 */

import type { UINode } from "../../types.js"
import type { Length, A11y } from "../types.js"
import { encodeLength, encodeA11y } from "../types.js"
import { containerNode, putIf, autoId } from "../build.js"

/** Props for the Grid widget. */
export interface GridProps {
  id?: string
  columns?: number
  columnCount?: number
  spacing?: number
  width?: Length
  height?: Length
  columnWidth?: number
  rowHeight?: number
  fluid?: boolean
  a11y?: A11y
  children?: UINode[]
}

export function Grid(props: GridProps): UINode {
  const id = props.id ?? autoId("grid")
  const children = props.children ?? []
  const p: Record<string, unknown> = {}
  putIf(p, props.columns, "columns")
  putIf(p, props.columnCount, "column_count")
  putIf(p, props.spacing, "spacing")
  putIf(p, props.width, "width", encodeLength)
  putIf(p, props.height, "height", encodeLength)
  putIf(p, props.columnWidth, "column_width")
  putIf(p, props.rowHeight, "row_height")
  putIf(p, props.fluid, "fluid")
  putIf(p, props.a11y, "a11y", encodeA11y)
  return containerNode(id, "grid", p, Array.isArray(children) ? children : [children])
}

export function grid(children: UINode[]): UINode
export function grid(opts: Omit<GridProps, "children">, children: UINode[]): UINode
export function grid(
  first: UINode[] | Omit<GridProps, "children">,
  second?: UINode[],
): UINode {
  if (Array.isArray(first)) {
    return Grid({ children: first })
  }
  return Grid({ ...first, children: second ?? [] })
}

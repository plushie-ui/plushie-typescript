/**
 * Row layout widget -- arranges children horizontally.
 *
 * @module
 */

import type { UINode } from "../../types.js"
import type { Length, Padding, Alignment, A11y } from "../types.js"
import { encodeLength, encodePadding, encodeAlignment, encodeA11y } from "../types.js"
import { containerNode, putIf, autoId } from "../build.js"

/** Props for the Row widget. */
export interface RowProps {
  id?: string
  spacing?: number
  padding?: Padding
  width?: Length
  height?: Length
  maxWidth?: number
  alignY?: Alignment
  clip?: boolean
  wrap?: boolean
  a11y?: A11y
  eventRate?: number
  children?: UINode[]
}

/**
 * Row JSX component.
 *
 * ```tsx
 * <Row spacing={8}>
 *   <Button>A</Button>
 *   <Button>B</Button>
 * </Row>
 * ```
 */
export function Row(props: RowProps): UINode {
  const id = props.id ?? autoId("row")
  const children = props.children ?? []
  const p: Record<string, unknown> = {}
  putIf(p, props.spacing, "spacing")
  putIf(p, props.padding, "padding", encodePadding)
  putIf(p, props.width, "width", encodeLength)
  putIf(p, props.height, "height", encodeLength)
  putIf(p, props.maxWidth, "max_width")
  putIf(p, props.alignY, "align_y", encodeAlignment)
  putIf(p, props.clip, "clip")
  putIf(p, props.wrap, "wrap")
  putIf(p, props.a11y, "a11y", encodeA11y)
  putIf(p, props.eventRate, "event_rate")
  return containerNode(id, "row", p, Array.isArray(children) ? children : [children])
}

/**
 * Row function API.
 *
 * ```ts
 * row([button("A"), button("B")])
 * row({ spacing: 8 }, [button("A"), button("B")])
 * ```
 */
export function row(children: UINode[]): UINode
export function row(opts: Omit<RowProps, "children">, children: UINode[]): UINode
export function row(
  first: UINode[] | Omit<RowProps, "children">,
  second?: UINode[],
): UINode {
  if (Array.isArray(first)) {
    return Row({ children: first })
  }
  return Row({ ...first, children: second ?? [] })
}

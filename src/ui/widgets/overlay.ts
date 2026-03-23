/**
 * Overlay -- positions the second child as a floating overlay
 * relative to the first child (anchor). Exactly 2 children.
 *
 * @module
 */

import type { UINode } from "../../types.js"
import type { Length, Alignment, A11y } from "../types.js"
import { encodeLength, encodeAlignment, encodeA11y } from "../types.js"
import { containerNode, putIf, autoId } from "../build.js"

/** Props for the Overlay widget. */
export interface OverlayProps {
  /** Unique widget identifier. */
  id?: string
  /** Where the overlay appears relative to the anchor child. */
  position?: "below" | "above" | "left" | "right"
  /** Gap between the anchor and the overlay in pixels. */
  gap?: number
  /** Horizontal offset from the computed overlay position in pixels. */
  offsetX?: number
  /** Vertical offset from the computed overlay position in pixels. */
  offsetY?: number
  /** When true, the overlay flips to the opposite side if it would overflow the viewport. */
  flip?: boolean
  /** Alignment of the overlay along the cross-axis relative to the anchor. */
  align?: Alignment
  /** Width of the overlay container. */
  width?: Length
  /** Accessibility properties. */
  a11y?: A11y
  /** Exactly 2 children: the anchor element and the overlay content. */
  children?: UINode[]
}

export function Overlay(props: OverlayProps): UINode {
  const id = props.id ?? autoId("overlay")
  const children = props.children ?? []
  const p: Record<string, unknown> = {}
  putIf(p, props.position, "position")
  putIf(p, props.gap, "gap")
  putIf(p, props.offsetX, "offset_x")
  putIf(p, props.offsetY, "offset_y")
  putIf(p, props.flip, "flip")
  putIf(p, props.align, "align", encodeAlignment)
  putIf(p, props.width, "width", encodeLength)
  putIf(p, props.a11y, "a11y", encodeA11y)
  return containerNode(id, "overlay", p, Array.isArray(children) ? children : [children])
}

export function overlay(
  opts: Omit<OverlayProps, "children">,
  children: UINode[],
): UINode {
  return Overlay({ ...opts, children })
}

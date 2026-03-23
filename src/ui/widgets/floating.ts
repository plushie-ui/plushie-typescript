/**
 * Floating -- applies transform (translate, scale) to child content.
 *
 * @module
 */

import type { UINode } from "../../types.js"
import type { A11y, Length } from "../types.js"
import { encodeA11y, encodeLength } from "../types.js"
import { containerNode, putIf, autoId } from "../build.js"

/** Props for the Floating widget. */
export interface FloatingProps {
  /** Unique widget identifier. */
  id?: string
  /** Horizontal translation offset in pixels. */
  translateX?: number
  /** Vertical translation offset in pixels. */
  translateY?: number
  /** Scale factor applied to child content. */
  scale?: number
  /** Width of the floating container. */
  width?: Length
  /** Height of the floating container. */
  height?: Length
  /** Accessibility properties. */
  a11y?: A11y
  /** Child widgets that receive the transform. */
  children?: UINode[]
}

export function Floating(props: FloatingProps): UINode {
  const id = props.id ?? autoId("floating")
  const children = props.children ?? []
  const p: Record<string, unknown> = {}
  putIf(p, props.translateX, "translate_x")
  putIf(p, props.translateY, "translate_y")
  putIf(p, props.scale, "scale")
  putIf(p, props.width, "width", encodeLength)
  putIf(p, props.height, "height", encodeLength)
  putIf(p, props.a11y, "a11y", encodeA11y)
  return containerNode(id, "floating", p, Array.isArray(children) ? children : [children])
}

export function floating(opts: Omit<FloatingProps, "children">, children: UINode[]): UINode {
  return Floating({ ...opts, children })
}

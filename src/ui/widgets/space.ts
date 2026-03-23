/**
 * Space -- invisible spacer widget.
 *
 * @module
 */

import type { UINode } from "../../types.js"
import type { Length, A11y } from "../types.js"
import { encodeLength, encodeA11y } from "../types.js"
import { leafNode, putIf, autoId } from "../build.js"

/** Props for the Space widget. */
export interface SpaceProps {
  id?: string
  width?: Length
  height?: Length
  a11y?: A11y
}

export function Space(props: SpaceProps): UINode {
  const id = props.id ?? autoId("space")
  const p: Record<string, unknown> = {}
  putIf(p, props.width, "width", encodeLength)
  putIf(p, props.height, "height", encodeLength)
  putIf(p, props.a11y, "a11y", encodeA11y)
  return leafNode(id, "space", p)
}

export function space(opts?: SpaceProps): UINode {
  return Space(opts ?? {})
}

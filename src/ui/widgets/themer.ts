/**
 * Themer -- applies a theme to child content.
 *
 * @module
 */

import type { UINode } from "../../types.js"
import type { A11y, Theme } from "../types.js"
import { encodeA11y } from "../types.js"
import { containerNode, putIf, autoId } from "../build.js"

/** Props for the Themer widget. */
export interface ThemerProps {
  id?: string
  theme?: Theme
  a11y?: A11y
  children?: UINode[]
}

export function Themer(props: ThemerProps): UINode {
  const id = props.id ?? autoId("themer")
  const children = props.children ?? []
  const p: Record<string, unknown> = {}
  putIf(p, props.theme, "theme")
  putIf(p, props.a11y, "a11y", encodeA11y)
  return containerNode(id, "themer", p, Array.isArray(children) ? children : [children])
}

export function themer(
  theme: Theme,
  children: UINode[],
): UINode {
  return Themer({ theme, children })
}

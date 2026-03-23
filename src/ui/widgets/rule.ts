/**
 * Rule -- horizontal or vertical divider line.
 *
 * @module
 */

import type { UINode } from "../../types.js"
import type { Direction, StyleMap, A11y } from "../types.js"
import { encodeStyleMap, encodeA11y } from "../types.js"
import { leafNode, putIf, autoId } from "../build.js"

/** Props for the Rule widget. */
export interface RuleProps {
  /** Unique widget identifier. */
  id?: string
  /** Direction of the rule line ("horizontal" or "vertical"). */
  direction?: Direction
  /** Width of the rule in pixels. */
  width?: number
  /** Height of the rule in pixels. */
  height?: number
  /** Thickness of the divider line in pixels. */
  thickness?: number
  /** Style preset name or StyleMap overrides. */
  style?: StyleMap
  /** Accessibility properties. */
  a11y?: A11y
}

export function Rule(props: RuleProps): UINode {
  const id = props.id ?? autoId("rule")
  const p: Record<string, unknown> = {}
  putIf(p, props.direction, "direction")
  putIf(p, props.width, "width")
  putIf(p, props.height, "height")
  putIf(p, props.thickness, "thickness")
  putIf(p, props.style, "style", encodeStyleMap)
  putIf(p, props.a11y, "a11y", encodeA11y)
  return leafNode(id, "rule", p)
}

export function rule(opts?: RuleProps): UINode {
  return Rule(opts ?? {})
}

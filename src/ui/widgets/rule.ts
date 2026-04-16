/**
 * Rule: horizontal or vertical divider line.
 *
 * @module
 */

import type { UINode } from "../../types.js";
import { applyA11yDefaults, autoId, leafNode, putIf } from "../build.js";
import type { A11y, Direction, StyleMap } from "../types.js";
import { encodeA11y, encodeStyleMap } from "../types.js";

/** Props for the Rule widget. */
export interface RuleProps {
  /** Unique widget identifier. */
  id?: string;
  /** Direction of the rule line ("horizontal" or "vertical"). */
  direction?: Direction;
  /** Width of the rule in pixels. */
  width?: number;
  /** Height of the rule in pixels. */
  height?: number;
  /** Thickness of the divider line in pixels. */
  thickness?: number;
  /** Style preset name or StyleMap overrides. */
  style?: StyleMap;
  /** Accessibility properties. */
  a11y?: A11y;
}

export function Rule(props: RuleProps): UINode {
  const id = props.id ?? autoId("rule");
  const p: Record<string, unknown> = {};
  putIf(p, props.direction, "direction");
  putIf(p, props.width, "width");
  putIf(p, props.height, "height");
  putIf(p, props.thickness, "thickness");
  putIf(p, props.style, "style", encodeStyleMap);
  applyA11yDefaults(p, props.a11y, { role: "splitter" }, encodeA11y);
  return leafNode(id, "rule", p);
}

export function rule(opts?: RuleProps): UINode {
  return Rule(opts ?? {});
}

/**
 * Pin: positions child at absolute coordinates within a Stack.
 *
 * @module
 */

import type { UINode } from "../../types.js";
import { autoId, containerNode, putIf } from "../build.js";
import type { A11y, Length } from "../types.js";
import { encodeA11y, encodeLength } from "../types.js";

/** Props for the Pin widget. */
export interface PinProps {
  /** Unique widget identifier. */
  id?: string;
  /** Absolute X position in pixels within the parent Stack. */
  x?: number;
  /** Absolute Y position in pixels within the parent Stack. */
  y?: number;
  /** Width of the pinned element. */
  width?: Length;
  /** Height of the pinned element. */
  height?: Length;
  /** Accessibility properties. */
  a11y?: A11y;
  /** Child widgets positioned at the pin coordinates. */
  children?: UINode[];
}

export function Pin(props: PinProps): UINode {
  const id = props.id ?? autoId("pin");
  const children = props.children ?? [];
  const p: Record<string, unknown> = {};
  putIf(p, props.x, "x");
  putIf(p, props.y, "y");
  putIf(p, props.width, "width", encodeLength);
  putIf(p, props.height, "height", encodeLength);
  putIf(p, props.a11y, "a11y", encodeA11y);
  return containerNode(id, "pin", p, Array.isArray(children) ? children : [children]);
}

export function pin(opts: Omit<PinProps, "children">, children: UINode[]): UINode {
  return Pin({ ...opts, children });
}

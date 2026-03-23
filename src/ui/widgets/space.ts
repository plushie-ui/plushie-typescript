/**
 * Space -- invisible spacer widget.
 *
 * @module
 */

import type { UINode } from "../../types.js";
import { autoId, leafNode, putIf } from "../build.js";
import type { A11y, Length } from "../types.js";
import { encodeA11y, encodeLength } from "../types.js";

/** Props for the Space widget. */
export interface SpaceProps {
  /** Unique widget identifier. */
  id?: string;
  /** Width of the spacer. */
  width?: Length;
  /** Height of the spacer. */
  height?: Length;
  /** Accessibility properties. */
  a11y?: A11y;
}

export function Space(props: SpaceProps): UINode {
  const id = props.id ?? autoId("space");
  const p: Record<string, unknown> = {};
  putIf(p, props.width, "width", encodeLength);
  putIf(p, props.height, "height", encodeLength);
  putIf(p, props.a11y, "a11y", encodeA11y);
  return leafNode(id, "space", p);
}

export function space(opts?: SpaceProps): UINode {
  return Space(opts ?? {});
}

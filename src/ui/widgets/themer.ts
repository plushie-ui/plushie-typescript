/**
 * Themer: applies a theme to child content.
 *
 * @module
 */

import type { UINode } from "../../types.js";
import { autoId, containerNode, putIf } from "../build.js";
import type { A11y, Theme } from "../types.js";
import { encodeA11y } from "../types.js";

/** Props for the Themer widget. */
export interface ThemerProps {
  /** Unique widget identifier. */
  id?: string;
  /** Theme applied to all child widgets, overriding the window theme. */
  theme?: Theme;
  /** Accessibility properties. */
  a11y?: A11y;
  /** Child widgets that inherit the specified theme. */
  children?: UINode[];
}

export function Themer(props: ThemerProps): UINode {
  const id = props.id ?? autoId("themer");
  const children = props.children ?? [];
  const p: Record<string, unknown> = {};
  putIf(p, props.theme, "theme");
  putIf(p, props.a11y, "a11y", encodeA11y);
  return containerNode(id, "themer", p, Array.isArray(children) ? children : [children]);
}

export function themer(theme: Theme, children: UINode[]): UINode {
  return Themer({ theme, children });
}

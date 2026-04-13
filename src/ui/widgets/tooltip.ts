/**
 * Tooltip: shows a popup tip over child content on hover.
 *
 * @module
 */

import type { UINode } from "../../types.js";
import { autoId, containerNode, putIf } from "../build.js";
import type { A11y, StyleMap } from "../types.js";
import { encodeA11y, encodeStyleMap } from "../types.js";

/** Props for the Tooltip widget. */
export interface TooltipProps {
  /** Unique widget identifier. */
  id?: string;
  /** Tooltip text content shown on hover. */
  tip: string;
  /** Where the tooltip appears relative to the child widget. */
  position?: "top" | "bottom" | "left" | "right" | "follow_cursor";
  /** Gap between the child widget and the tooltip in pixels. */
  gap?: number;
  /** Inner padding of the tooltip bubble in pixels. */
  padding?: number;
  /** When true, repositions the tooltip to stay within the viewport. */
  snapWithinViewport?: boolean;
  /** Delay in milliseconds before the tooltip appears on hover. */
  delay?: number;
  /** Style preset name or StyleMap overrides for the tooltip bubble. */
  style?: StyleMap;
  /** Accessibility properties. */
  a11y?: A11y;
  /** The child widget that triggers the tooltip on hover. */
  children?: UINode[];
}

export function Tooltip(props: TooltipProps): UINode {
  const id = props.id ?? autoId("tooltip");
  const children = props.children ?? [];
  const p: Record<string, unknown> = { tip: props.tip };
  putIf(p, props.position, "position");
  putIf(p, props.gap, "gap");
  putIf(p, props.padding, "padding");
  putIf(p, props.snapWithinViewport, "snap_within_viewport");
  putIf(p, props.delay, "delay");
  putIf(p, props.style, "style", encodeStyleMap);
  putIf(p, props.a11y, "a11y", encodeA11y);
  return containerNode(id, "tooltip", p, Array.isArray(children) ? children : [children]);
}

export function tooltip(
  tip: string,
  opts: Omit<TooltipProps, "tip" | "children">,
  children: UINode[],
): UINode {
  return Tooltip({ tip, ...opts, children });
}

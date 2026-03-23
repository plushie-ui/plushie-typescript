/**
 * Row layout widget -- arranges children horizontally.
 *
 * @module
 */

import type { UINode } from "../../types.js";
import { autoId, containerNode, putIf } from "../build.js";
import type { A11y, Alignment, Length, Padding } from "../types.js";
import { encodeA11y, encodeAlignment, encodeLength, encodePadding } from "../types.js";

/** Props for the Row widget. */
export interface RowProps {
  /** Unique widget identifier. */
  id?: string;
  /** Horizontal spacing between children in pixels. */
  spacing?: number;
  /** Inner padding. */
  padding?: Padding;
  /** Width of the row. */
  width?: Length;
  /** Height of the row. */
  height?: Length;
  /** Maximum width in pixels. */
  maxWidth?: number;
  /** Vertical alignment of children within the row. */
  alignY?: Alignment;
  /** When true, clips child content that overflows the row bounds. */
  clip?: boolean;
  /** When true, wraps children to the next row when they exceed the width. */
  wrap?: boolean;
  /** Accessibility properties. */
  a11y?: A11y;
  /** Maximum events per second for this widget's coalescable events. */
  eventRate?: number;
  /** Child widgets arranged horizontally. */
  children?: UINode[];
}

/**
 * Row JSX component.
 *
 * ```tsx
 * <Row spacing={8}>
 *   <Button>A</Button>
 *   <Button>B</Button>
 * </Row>
 * ```
 */
export function Row(props: RowProps): UINode {
  const id = props.id ?? autoId("row");
  const children = props.children ?? [];
  const p: Record<string, unknown> = {};
  putIf(p, props.spacing, "spacing");
  putIf(p, props.padding, "padding", encodePadding);
  putIf(p, props.width, "width", encodeLength);
  putIf(p, props.height, "height", encodeLength);
  putIf(p, props.maxWidth, "max_width");
  putIf(p, props.alignY, "align_y", encodeAlignment);
  putIf(p, props.clip, "clip");
  putIf(p, props.wrap, "wrap");
  putIf(p, props.a11y, "a11y", encodeA11y);
  putIf(p, props.eventRate, "event_rate");
  return containerNode(id, "row", p, Array.isArray(children) ? children : [children]);
}

/**
 * Row function API.
 *
 * ```ts
 * row([button("A"), button("B")])
 * row({ spacing: 8 }, [button("A"), button("B")])
 * ```
 */
export function row(children: UINode[]): UINode;
export function row(opts: Omit<RowProps, "children">, children: UINode[]): UINode;
export function row(first: UINode[] | Omit<RowProps, "children">, second?: UINode[]): UINode {
  if (Array.isArray(first)) {
    return Row({ children: first });
  }
  return Row({ ...first, children: second ?? [] });
}

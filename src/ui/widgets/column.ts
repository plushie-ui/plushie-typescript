/**
 * Column layout widget: arranges children vertically.
 *
 * @module
 */

import type { UINode } from "../../types.js";
import { autoId, containerNode, putIf } from "../build.js";
import type { A11y, Alignment, Length, Padding } from "../types.js";
import { encodeA11y, encodeAlignment, encodeLength, encodePadding } from "../types.js";

/** Props for the Column widget. */
export interface ColumnProps {
  /** Unique widget identifier. */
  id?: string;
  /** Vertical spacing between children in pixels. */
  spacing?: number;
  /** Inner padding. */
  padding?: Padding;
  /** Width of the column. */
  width?: Length;
  /** Height of the column. */
  height?: Length;
  /** Maximum width in pixels. */
  maxWidth?: number;
  /** Horizontal alignment of children within the column. */
  alignX?: Alignment;
  /** When true, clips child content that overflows the column bounds. */
  clip?: boolean;
  /** When true, wraps children to the next column when they exceed the height. */
  wrap?: boolean;
  /** Accessibility properties. */
  a11y?: A11y;
  /** Maximum events per second for this widget's coalescable events. */
  eventRate?: number;
  /** Child widgets arranged vertically. */
  children?: UINode[];
}

/**
 * Column JSX component.
 *
 * ```tsx
 * <Column id="main" padding={16} spacing={8}>
 *   <Text>Hello</Text>
 *   <Button>OK</Button>
 * </Column>
 * ```
 */
export function Column(props: ColumnProps): UINode {
  const id = props.id ?? autoId("column");
  const children = props.children ?? [];
  const p: Record<string, unknown> = {};
  putIf(p, props.spacing, "spacing");
  putIf(p, props.padding, "padding", encodePadding);
  putIf(p, props.width, "width", encodeLength);
  putIf(p, props.height, "height", encodeLength);
  putIf(p, props.maxWidth, "max_width");
  putIf(p, props.alignX, "align_x", encodeAlignment);
  putIf(p, props.clip, "clip");
  putIf(p, props.wrap, "wrap");
  putIf(p, props.a11y, "a11y", encodeA11y);
  putIf(p, props.eventRate, "event_rate");
  return containerNode(id, "column", p, Array.isArray(children) ? children : [children]);
}

/**
 * Column function API.
 *
 * ```ts
 * column([text("Hello"), button("OK")])
 * column({ padding: 16, spacing: 8 }, [text("Hello")])
 * ```
 */
export function column(children: UINode[]): UINode;
export function column(opts: Omit<ColumnProps, "children">, children: UINode[]): UINode;
export function column(first: UINode[] | Omit<ColumnProps, "children">, second?: UINode[]): UINode {
  if (Array.isArray(first)) {
    return Column({ children: first });
  }
  return Column({ ...first, children: second ?? [] });
}

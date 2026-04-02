/**
 * Grid layout -- arranges children in a grid.
 *
 * @module
 */

import type { UINode } from "../../types.js";
import { autoId, containerNode, putIf } from "../build.js";
import type { A11y, Length } from "../types.js";
import { encodeA11y, encodeLength } from "../types.js";

/** Props for the Grid widget. */
export interface GridProps {
  /** Unique widget identifier. */
  id?: string;
  /** Number of columns in the grid. */
  columns?: number;
  /** Spacing between cells in pixels. */
  spacing?: number;
  /** Width of the grid. */
  width?: Length;
  /** Height of the grid. */
  height?: Length;
  /** Fixed width for each column in pixels. */
  columnWidth?: number;
  /** Fixed height for each row in pixels. */
  rowHeight?: number;
  /** When true, columns auto-wrap based on max cell width. */
  fluid?: boolean;
  /** Accessibility properties. */
  a11y?: A11y;
  /** Child widgets placed into grid cells in order. */
  children?: UINode[];
}

export function Grid(props: GridProps): UINode {
  const id = props.id ?? autoId("grid");
  const children = props.children ?? [];
  const p: Record<string, unknown> = {};
  putIf(p, props.columns, "columns");
  putIf(p, props.spacing, "spacing");
  putIf(p, props.width, "width", encodeLength);
  putIf(p, props.height, "height", encodeLength);
  putIf(p, props.columnWidth, "column_width");
  putIf(p, props.rowHeight, "row_height");
  putIf(p, props.fluid, "fluid");
  putIf(p, props.a11y, "a11y", encodeA11y);
  return containerNode(id, "grid", p, Array.isArray(children) ? children : [children]);
}

export function grid(children: UINode[]): UINode;
export function grid(opts: Omit<GridProps, "children">, children: UINode[]): UINode;
export function grid(first: UINode[] | Omit<GridProps, "children">, second?: UINode[]): UINode {
  if (Array.isArray(first)) {
    return Grid({ children: first });
  }
  return Grid({ ...first, children: second ?? [] });
}

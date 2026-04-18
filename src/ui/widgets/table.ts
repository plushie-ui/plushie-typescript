/**
 * Table: data table with sortable columns.
 *
 * @module
 */

import type { Handler, UINode } from "../../types.js";
import {
  applyA11yDefaults,
  autoId,
  containerNode,
  extractHandlers,
  leafNodeWithMeta,
  putIf,
} from "../build.js";
import type { A11y, Color, Length, Padding } from "../types.js";
import { encodeA11y, encodeColor, encodeLength, encodePadding } from "../types.js";
import { text } from "./text.js";

const TABLE_HANDLERS = { onSort: "sort" } as const;

/**
 * A column definition for the Table widget. Uses a fixed schema
 * of typed fields rather than arbitrary key/value pairs.
 */
export interface TableColumn {
  /** Lookup key into row data maps. */
  readonly key: string;
  /** Display text for the column header. */
  readonly label: string;
  /** Horizontal alignment for column cells ("left", "center", "right"). */
  readonly align?: string;
  /** Column width as a Length value. Defaults to fill. */
  readonly width?: Length;
  /** Whether clicking the header triggers a sort event. */
  readonly sortable?: boolean;
}

/**
 * A data row for the Table widget. Keys are strings matching
 * column `key` values, values are rendered as text.
 *
 * String keys are the convention because row schemas are typically
 * user-defined or come from external data (JSON, database queries).
 */
export type TableRow = Record<string, unknown>;

/** Props for the Table widget. */
export interface TableProps {
  /** Unique widget identifier. */
  id?: string;
  /** Column definitions with typed schema. */
  columns: TableColumn[];
  /** Row data objects. Each row's keys should match column keys. */
  rows: TableRow[];
  /** Width of the table. */
  width?: Length;
  /** Whether to show the header row. */
  header?: boolean;
  /** Cell padding. */
  padding?: Padding;
  /** Column key currently being sorted by. */
  sortBy?: string;
  /** Sort direction for the active sort column. */
  sortOrder?: "asc" | "desc";
  /** Font size for the header row in pixels. */
  headerTextSize?: number;
  /** Font size for body rows in pixels. */
  rowTextSize?: number;
  /** Horizontal spacing between cells in pixels. */
  cellSpacing?: number;
  /** Vertical spacing between rows in pixels. */
  rowSpacing?: number;
  /** Thickness of row separator lines in pixels. */
  separatorThickness?: number;
  /** Color of row separator lines. */
  separatorColor?: Color;
  /** Whether to show row separator lines. */
  separator?: boolean;
  /** Accessibility properties. */
  a11y?: A11y;
  /** Maximum events per second for this widget's coalescable events. */
  eventRate?: number;
  /** Sort handler, called when a column header is clicked. */
  onSort?: Handler<unknown>;
}

export function Table(props: TableProps): UINode {
  const id = props.id ?? autoId("table");
  const { clean, meta } = extractHandlers(id, props, TABLE_HANDLERS);
  const p: Record<string, unknown> = {
    columns: clean.columns,
  };
  putIf(p, clean.width, "width", encodeLength);
  putIf(p, clean.header, "header");
  putIf(p, clean.padding, "padding", encodePadding);
  putIf(p, clean.sortBy, "sort_by");
  putIf(p, clean.sortOrder, "sort_order");
  putIf(p, clean.headerTextSize, "header_text_size");
  putIf(p, clean.rowTextSize, "row_text_size");
  putIf(p, clean.cellSpacing, "cell_spacing");
  putIf(p, clean.rowSpacing, "row_spacing");
  putIf(p, clean.separatorThickness, "separator_thickness");
  putIf(p, clean.separatorColor, "separator_color", encodeColor);
  putIf(p, clean.separator, "separator");
  applyA11yDefaults(p, clean.a11y, { role: "table" }, encodeA11y);
  putIf(p, clean.eventRate, "event_rate");

  if (Array.isArray(clean.rows) && clean.rows.length > 0 && Array.isArray(clean.columns)) {
    const colKeys = clean.columns.map((c) => String(c.key));
    const rowChildren = clean.rows.map((row, rowIdx) => {
      // Row and cell IDs are local to the table scope. The normalizer
      // prefixes them with the table's scoped ID automatically, so we
      // must not embed `/` here (it is reserved for scope paths).
      const rowId =
        (row as Record<string, unknown>)["id"] != null
          ? String((row as Record<string, unknown>)["id"])
          : `row_${String(rowIdx)}`;
      const cells = colKeys.map((key) => {
        const value = String((row as Record<string, unknown>)[key] ?? "");
        return tableCell(key, key, [text(value)]);
      });
      return tableRow(rowId, cells);
    });
    return containerNode(id, "table", p, rowChildren);
  }

  putIf(p, clean.rows, "rows");
  return leafNodeWithMeta(id, "table", p, meta);
}

export function table(
  id: string,
  columns: TableColumn[],
  rows: TableRow[],
  opts?: Omit<TableProps, "id" | "columns" | "rows">,
): UINode {
  return Table({ id, columns, rows, ...opts });
}

/**
 * A table row with explicit ID. Children are `tableCell` nodes, one per column.
 *
 * Used for rich table composition where cells contain arbitrary widgets
 * (buttons, icons, etc.) instead of plain text data.
 */
export function tableRow(id: string, children: readonly UINode[]): UINode {
  return containerNode(id, "table_row", { id }, [...children]);
}

/**
 * A table cell mapped to a specific column. Children are the cell's
 * widget content.
 *
 * The `column` field must match a `TableColumn.key` from the parent table.
 */
export function tableCell(id: string, column: string, children: readonly UINode[]): UINode {
  return containerNode(id, "table_cell", { column, id }, [...children]);
}

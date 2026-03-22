/**
 * Table -- data table with sortable columns.
 *
 * @module
 */

import type { UINode, Handler } from "../../types.js"
import type { Length, Padding, Color, A11y } from "../types.js"
import { encodeLength, encodePadding, encodeColor, encodeA11y } from "../types.js"
import { leafNode, putIf, autoId, extractHandlers } from "../build.js"

const TABLE_HANDLERS = { onSort: "sort" } as const

/** Props for the Table widget. */
export interface TableProps {
  id?: string
  columns: Record<string, unknown>[]
  rows: Record<string, unknown>[]
  width?: Length
  header?: boolean
  padding?: Padding
  sortBy?: string
  sortOrder?: "asc" | "desc"
  headerTextSize?: number
  rowTextSize?: number
  cellSpacing?: number
  rowSpacing?: number
  separatorThickness?: number
  separatorColor?: Color
  separator?: boolean
  a11y?: A11y
  eventRate?: number
  onSort?: Handler<unknown>
}

export function Table(props: TableProps): UINode {
  const id = props.id ?? autoId("table")
  const clean = extractHandlers(id, props, TABLE_HANDLERS)
  const p: Record<string, unknown> = {
    columns: clean.columns,
    rows: clean.rows,
  }
  putIf(p, clean.width, "width", encodeLength)
  putIf(p, clean.header, "header")
  putIf(p, clean.padding, "padding", encodePadding)
  putIf(p, clean.sortBy, "sort_by")
  putIf(p, clean.sortOrder, "sort_order")
  putIf(p, clean.headerTextSize, "header_text_size")
  putIf(p, clean.rowTextSize, "row_text_size")
  putIf(p, clean.cellSpacing, "cell_spacing")
  putIf(p, clean.rowSpacing, "row_spacing")
  putIf(p, clean.separatorThickness, "separator_thickness")
  putIf(p, clean.separatorColor, "separator_color", encodeColor)
  putIf(p, clean.separator, "separator")
  putIf(p, clean.a11y, "a11y", encodeA11y)
  putIf(p, clean.eventRate, "event_rate")
  return leafNode(id, "table", p)
}

export function table(
  id: string,
  columns: Record<string, unknown>[],
  rows: Record<string, unknown>[],
  opts?: Omit<TableProps, "id" | "columns" | "rows">,
): UINode {
  return Table({ id, columns, rows, ...opts })
}

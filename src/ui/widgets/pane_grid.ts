/**
 * Pane grid -- resizable tiled panes.
 *
 * @module
 */

import type { UINode, Handler } from "../../types.js"
import type { Length, Color, A11y } from "../types.js"
import { encodeLength, encodeColor, encodeA11y } from "../types.js"
import { containerNode, putIf, autoId, extractHandlers } from "../build.js"

const PANE_GRID_HANDLERS = {
  onPaneClick: "clicked",
  onPaneResize: "resized",
  onPaneDrag: "dragged",
} as const

/** Props for the PaneGrid widget. */
export interface PaneGridProps {
  id?: string
  spacing?: number
  width?: Length
  height?: Length
  minSize?: number
  leeway?: number
  dividerColor?: Color
  dividerWidth?: number
  splitAxis?: "horizontal" | "vertical"
  a11y?: A11y
  eventRate?: number
  onPaneClick?: Handler<unknown>
  onPaneResize?: Handler<unknown>
  onPaneDrag?: Handler<unknown>
  children?: UINode[]
}

export function PaneGrid(props: PaneGridProps): UINode {
  const id = props.id ?? autoId("pane_grid")
  const children = props.children ?? []
  const clean = extractHandlers(id, props, PANE_GRID_HANDLERS)
  const p: Record<string, unknown> = {}
  putIf(p, clean.spacing, "spacing")
  putIf(p, clean.width, "width", encodeLength)
  putIf(p, clean.height, "height", encodeLength)
  putIf(p, clean.minSize, "min_size")
  putIf(p, clean.leeway, "leeway")
  putIf(p, clean.dividerColor, "divider_color", encodeColor)
  putIf(p, clean.dividerWidth, "divider_width")
  putIf(p, clean.splitAxis, "split_axis")
  putIf(p, clean.a11y, "a11y", encodeA11y)
  putIf(p, clean.eventRate, "event_rate")
  return containerNode(id, "pane_grid", p, Array.isArray(children) ? children : [children])
}

export function paneGrid(
  opts: Omit<PaneGridProps, "children">,
  children: UINode[],
): UINode {
  return PaneGrid({ ...opts, children })
}

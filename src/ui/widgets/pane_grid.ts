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
  /** Unique widget identifier. */
  id?: string
  /** Spacing between panes in pixels. */
  spacing?: number
  /** Width of the pane grid. */
  width?: Length
  /** Height of the pane grid. */
  height?: Length
  /** Minimum size of each pane in pixels. Prevents panes from being resized too small. */
  minSize?: number
  /** Extra drag distance beyond the divider line that still counts as a resize gesture, in pixels. */
  leeway?: number
  /** Color of the divider lines between panes. */
  dividerColor?: Color
  /** Thickness of the divider lines between panes in pixels. */
  dividerWidth?: number
  /** Default axis for new pane splits ("horizontal" or "vertical"). */
  splitAxis?: "horizontal" | "vertical"
  /** Accessibility properties. */
  a11y?: A11y
  /** Maximum events per second for this widget's coalescable events. */
  eventRate?: number
  /** Handler called when a pane is clicked. */
  onPaneClick?: Handler<unknown>
  /** Handler called when the divider between panes is dragged. */
  onPaneResize?: Handler<unknown>
  /** Handler called when a pane is dragged for reordering. */
  onPaneDrag?: Handler<unknown>
  /** Pane children. Each child is a pane in the grid. */
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

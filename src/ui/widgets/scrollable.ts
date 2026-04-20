/**
 * Scrollable container: wraps child content in a scrollable viewport.
 *
 * @module
 */

import type { Handler, UINode } from "../../types.js";
import {
  applyA11yDefaults,
  autoId,
  containerNodeWithMeta,
  extractHandlers,
  putIf,
} from "../build.js";
import type { A11y, Anchor, Color, Direction, Length } from "../types.js";
import { encodeA11y, encodeColor, encodeLength } from "../types.js";

const _SCROLLABLE_HANDLERS = { onScroll: "scrolled" } as const;

/** Props for the Scrollable widget. */
export interface ScrollableProps {
  /** Unique widget identifier. */
  id?: string;
  /** Width of the scrollable viewport. */
  width?: Length;
  /** Height of the scrollable viewport. */
  height?: Length;
  /** Scroll direction: "horizontal", "vertical", or "both". */
  direction?: Direction | "both";
  /** Spacing between children in pixels. */
  spacing?: number;
  /** Width of the scrollbar track in pixels. */
  scrollbarWidth?: number;
  /** Margin between the scrollbar and the content edge in pixels. */
  scrollbarMargin?: number;
  /** Width of the scroller handle in pixels. */
  scrollerWidth?: number;
  /** Color of the scrollbar track. */
  scrollbarColor?: Color;
  /** Color of the scroller handle. */
  scrollerColor?: Color;
  /** Scroll anchor position ("start" or "end"). "end" keeps new content visible. */
  anchor?: Anchor;
  /** When true, automatically scrolls to the end when new content is added. */
  autoScroll?: boolean;
  /** Accessibility properties. */
  a11y?: A11y;
  /** Maximum events per second for this widget's coalescable events. */
  eventRate?: number;
  /** Scroll handler or boolean to enable scroll events. */
  onScroll?: Handler<unknown> | boolean;
  /** Child widgets rendered inside the scrollable viewport. */
  children?: UINode[];
}

export function Scrollable(props: ScrollableProps): UINode {
  const id = props.id ?? autoId("scrollable");
  const children = props.children ?? [];
  const handlerProps: Record<string, string> = {};
  if (typeof props.onScroll === "function") handlerProps["onScroll"] = "scrolled";
  const { clean, meta } = extractHandlers(id, props, handlerProps);

  const p: Record<string, unknown> = {};
  putIf(p, clean.width, "width", encodeLength);
  putIf(p, clean.height, "height", encodeLength);
  putIf(p, clean.direction, "direction");
  putIf(p, clean.spacing, "spacing");
  putIf(p, clean.scrollbarWidth, "scrollbar_width");
  putIf(p, clean.scrollbarMargin, "scrollbar_margin");
  putIf(p, clean.scrollerWidth, "scroller_width");
  putIf(p, clean.scrollbarColor, "scrollbar_color", encodeColor);
  putIf(p, clean.scrollerColor, "scroller_color", encodeColor);
  putIf(p, clean.anchor, "anchor");
  putIf(p, clean.autoScroll, "auto_scroll");
  applyA11yDefaults(p, clean.a11y, { role: "scroll_view" }, encodeA11y);
  putIf(p, clean.eventRate, "event_rate");
  if (typeof props.onScroll === "boolean") putIf(p, props.onScroll, "on_scroll");
  else if (typeof props.onScroll === "function") p["on_scroll"] = true;
  return containerNodeWithMeta(
    id,
    "scrollable",
    p,
    Array.isArray(children) ? children : [children],
    meta,
  );
}

export function scrollable(children: UINode[]): UINode;
export function scrollable(opts: Omit<ScrollableProps, "children">, children: UINode[]): UINode;
export function scrollable(
  first: UINode[] | Omit<ScrollableProps, "children">,
  second?: UINode[],
): UINode {
  if (Array.isArray(first)) {
    return Scrollable({ children: first });
  }
  return Scrollable({ ...first, children: second ?? [] });
}

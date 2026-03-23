/**
 * Mouse area -- captures mouse events on child content.
 *
 * @module
 */

import type { Handler, UINode } from "../../types.js";
import { autoId, containerNode, extractHandlers, putIf } from "../build.js";
import type { A11y } from "../types.js";
import { encodeA11y } from "../types.js";

const MOUSE_AREA_HANDLERS = {
  onPress: "press",
  onRelease: "release",
  onRightPress: "right_press",
  onRightRelease: "right_release",
  onMiddlePress: "middle_press",
  onMiddleRelease: "middle_release",
  onDoubleClick: "double_click",
  onEnter: "enter",
  onExit: "exit",
  onMove: "move",
  onScroll: "scroll",
} as const;

/** Props for the MouseArea widget. */
export interface MouseAreaProps {
  /** Unique widget identifier. */
  id?: string;
  /** CSS cursor name shown when hovering over the area (e.g., "pointer", "grab", "crosshair"). */
  cursor?: string;
  /** Accessibility properties. */
  a11y?: A11y;
  /** Maximum events per second for this widget's coalescable events. */
  eventRate?: number;
  /** Left mouse button press handler or boolean to enable the event. */
  onPress?: Handler<unknown> | boolean;
  /** Left mouse button release handler or boolean to enable the event. */
  onRelease?: Handler<unknown> | boolean;
  /** Right mouse button press handler or boolean to enable the event. */
  onRightPress?: Handler<unknown> | boolean;
  /** Right mouse button release handler or boolean to enable the event. */
  onRightRelease?: Handler<unknown> | boolean;
  /** Middle mouse button press handler or boolean to enable the event. */
  onMiddlePress?: Handler<unknown> | boolean;
  /** Middle mouse button release handler or boolean to enable the event. */
  onMiddleRelease?: Handler<unknown> | boolean;
  /** Double-click handler or boolean to enable the event. */
  onDoubleClick?: Handler<unknown> | boolean;
  /** Cursor enter handler or boolean to enable the event. */
  onEnter?: Handler<unknown> | boolean;
  /** Cursor exit handler or boolean to enable the event. */
  onExit?: Handler<unknown> | boolean;
  /** Cursor move handler or boolean to enable the event. Emits {x, y} data. */
  onMove?: Handler<unknown> | boolean;
  /** Scroll handler or boolean to enable the event. Emits {delta_x, delta_y} data. */
  onScroll?: Handler<unknown> | boolean;
  /** Child widgets that the mouse area wraps. */
  children?: UINode[];
}

export function MouseArea(props: MouseAreaProps): UINode {
  const id = props.id ?? autoId("mouse_area");
  const children = props.children ?? [];
  const handlerProps: Record<string, string> = {};
  for (const [key, wire] of Object.entries(MOUSE_AREA_HANDLERS)) {
    if (typeof (props as Record<string, unknown>)[key] === "function") {
      handlerProps[key] = wire;
    }
  }
  const clean = extractHandlers(id, props, handlerProps);

  const p: Record<string, unknown> = {};
  putIf(p, clean.cursor, "cursor");
  putIf(p, clean.a11y, "a11y", encodeA11y);
  putIf(p, clean.eventRate, "event_rate");
  // Boolean flags for event enablement
  for (const [key, wire] of Object.entries(MOUSE_AREA_HANDLERS)) {
    const val = (props as Record<string, unknown>)[key];
    if (typeof val === "boolean") putIf(p, val, `on_${wire}`);
    else if (typeof val === "function") p[`on_${wire}`] = true;
  }
  return containerNode(id, "mouse_area", p, Array.isArray(children) ? children : [children]);
}

export function mouseArea(opts: Omit<MouseAreaProps, "children">, children: UINode[]): UINode {
  return MouseArea({ ...opts, children });
}

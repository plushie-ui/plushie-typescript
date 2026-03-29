/**
 * Mouse area -- captures mouse events on child content.
 *
 * @module
 */

import type { Handler, UINode } from "../../types.js";
import { autoId, containerNodeWithMeta, extractHandlers, putIf } from "../build.js";
import type { A11y } from "../types.js";
import { encodeA11y } from "../types.js";

// Handler event type (for handler map registration) and wire prop suffix
// (for the boolean enable prop sent to the renderer).
//
// The handler event type matches the wire family the renderer emits.
// The wire prop suffix is what the renderer checks (on_<suffix>).
// These differ because mouse area wire families gained a mouse_ prefix
// but the renderer props didn't.
const MOUSE_AREA_EVENTS: Record<string, { readonly eventType: string; readonly wireProp: string }> =
  {
    onPress: { eventType: "click", wireProp: "press" },
    onRelease: { eventType: "click", wireProp: "release" },
    onRightPress: { eventType: "mouse_right_press", wireProp: "right_press" },
    onRightRelease: { eventType: "mouse_right_release", wireProp: "right_release" },
    onMiddlePress: { eventType: "mouse_middle_press", wireProp: "middle_press" },
    onMiddleRelease: { eventType: "mouse_middle_release", wireProp: "middle_release" },
    onDoubleClick: { eventType: "mouse_double_click", wireProp: "double_click" },
    onEnter: { eventType: "mouse_enter", wireProp: "enter" },
    onExit: { eventType: "mouse_exit", wireProp: "exit" },
    onMove: { eventType: "mouse_move", wireProp: "move" },
    onScroll: { eventType: "mouse_scroll", wireProp: "scroll" },
  };

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

  // Build handler prop mapping: prop name -> event type for handler registration
  const handlerProps: Record<string, string> = {};
  for (const [key, spec] of Object.entries(MOUSE_AREA_EVENTS)) {
    if (typeof (props as Record<string, unknown>)[key] === "function") {
      handlerProps[key] = spec.eventType;
    }
  }
  const { clean, meta } = extractHandlers(id, props, handlerProps);

  const p: Record<string, unknown> = {};
  putIf(p, clean.cursor, "cursor");
  putIf(p, clean.a11y, "a11y", encodeA11y);
  putIf(p, clean.eventRate, "event_rate");
  // Boolean flags for event enablement (wire prop names, not event types)
  for (const [key, spec] of Object.entries(MOUSE_AREA_EVENTS)) {
    const val = (props as Record<string, unknown>)[key];
    if (typeof val === "boolean") putIf(p, val, `on_${spec.wireProp}`);
    else if (typeof val === "function") p[`on_${spec.wireProp}`] = true;
  }
  return containerNodeWithMeta(
    id,
    "mouse_area",
    p,
    Array.isArray(children) ? children : [children],
    meta,
  );
}

export function mouseArea(opts: Omit<MouseAreaProps, "children">, children: UINode[]): UINode {
  return MouseArea({ ...opts, children });
}

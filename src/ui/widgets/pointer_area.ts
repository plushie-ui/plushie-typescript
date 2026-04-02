/**
 * Pointer area -- captures pointer events (mouse, touch, pen) on child content.
 *
 * Wraps child content and emits events for various pointer buttons,
 * hover enter/exit, cursor movement, scroll, and double-click.
 * Optionally sets the mouse cursor when hovering the area.
 *
 * @module
 */

import type { Handler, UINode } from "../../types.js";
import { autoId, containerNodeWithMeta, extractHandlers, putIf } from "../build.js";
import type { A11y } from "../types.js";
import { encodeA11y } from "../types.js";

// Props that support inline handler functions (registered in the handler map).
// These map to unique wire event types so handlers can be dispatched unambiguously.
//
// onRelease is deliberately excluded: the renderer emits left-release as
// family "click" with id "widgetId:release" (colon-suffixed). The handler
// lookup uses event.id, so the release event's suffixed ID doesn't match
// the registered handler key. Handle release in update() instead.
const HANDLER_EVENTS: Record<string, { readonly eventType: string; readonly wireProp: string }> = {
  onPress: { eventType: "click", wireProp: "press" },
  onMove: { eventType: "move", wireProp: "move" },
  onScroll: { eventType: "scroll", wireProp: "scroll" },
};

// Props that are boolean-only enable flags. These either share wire event
// types (right/middle press both produce "press" events) or use ID suffixes
// (release uses "id:release") that prevent inline handler dispatch.
const BOOLEAN_ONLY_PROPS: Record<string, string> = {
  onRelease: "release",
  onRightPress: "right_press",
  onRightRelease: "right_release",
  onMiddlePress: "middle_press",
  onMiddleRelease: "middle_release",
  onDoubleClick: "double_click",
  onEnter: "enter",
  onExit: "exit",
};

/**
 * Props for the PointerArea widget.
 *
 * `onPress` and `onRelease` accept handler functions or booleans.
 * As handlers, they receive `click` events (left button only).
 *
 * Other pointer event props (`onRightPress`, `onMiddlePress`, etc.)
 * are boolean-only enable flags. When enabled, the renderer emits
 * unified pointer events with the button/pointer type in the `data`
 * field. Handle these in `update()` using `isPress(event)` and
 * checking `event.data.button`.
 */
export interface PointerAreaProps {
  /** Unique widget identifier. */
  id?: string;
  /** CSS cursor name shown when hovering over the area (e.g., "pointer", "grab", "crosshair"). */
  cursor?: string;
  /** Accessibility properties. */
  a11y?: A11y;
  /** Maximum events per second for this widget's coalescable events. */
  eventRate?: number;
  /** Left mouse button press handler (receives click events) or boolean to enable. */
  onPress?: Handler<unknown> | boolean;
  /** Enable left mouse button release events. Handle via update (event has id suffix ":release"). */
  onRelease?: boolean;
  /** Enable right mouse button press events. Handle via `isPress` + `data.button === "right"` in update. */
  onRightPress?: boolean;
  /** Enable right mouse button release events. Handle via `isRelease` + `data.button === "right"` in update. */
  onRightRelease?: boolean;
  /** Enable middle mouse button press events. Handle via `isPress` + `data.button === "middle"` in update. */
  onMiddlePress?: boolean;
  /** Enable middle mouse button release events. Handle via `isRelease` + `data.button === "middle"` in update. */
  onMiddleRelease?: boolean;
  /** Enable double-click events. Handle via update. */
  onDoubleClick?: boolean;
  /** Enable pointer enter events. Handle via update. */
  onEnter?: boolean;
  /** Enable pointer exit events. Handle via update. */
  onExit?: boolean;
  /** Pointer move handler or boolean to enable move events. Emits {x, y, pointer, modifiers} data. */
  onMove?: Handler<unknown> | boolean;
  /** Scroll handler or boolean to enable scroll events. Emits {delta_x, delta_y, pointer, modifiers} data. */
  onScroll?: Handler<unknown> | boolean;
  /** Child widgets that the pointer area wraps. */
  children?: UINode[];
}

export function PointerArea(props: PointerAreaProps): UINode {
  const id = props.id ?? autoId("pointer_area");
  const children = props.children ?? [];

  // Register inline handlers for the handler-capable props
  const handlerProps: Record<string, string> = {};
  for (const [key, spec] of Object.entries(HANDLER_EVENTS)) {
    if (typeof (props as Record<string, unknown>)[key] === "function") {
      handlerProps[key] = spec.eventType;
    }
  }
  const { clean, meta } = extractHandlers(id, props, handlerProps);

  const p: Record<string, unknown> = {};
  putIf(p, clean.cursor, "cursor");
  putIf(p, clean.a11y, "a11y", encodeA11y);
  putIf(p, clean.eventRate, "event_rate");

  // Handler-capable props: boolean or function
  for (const [key, spec] of Object.entries(HANDLER_EVENTS)) {
    const val = (props as Record<string, unknown>)[key];
    if (typeof val === "boolean") putIf(p, val, `on_${spec.wireProp}`);
    else if (typeof val === "function") p[`on_${spec.wireProp}`] = true;
  }

  // Boolean-only props
  for (const [key, wireProp] of Object.entries(BOOLEAN_ONLY_PROPS)) {
    const val = (props as Record<string, unknown>)[key];
    if (typeof val === "boolean") putIf(p, val, `on_${wireProp}`);
  }

  return containerNodeWithMeta(
    id,
    "pointer_area",
    p,
    Array.isArray(children) ? children : [children],
    meta,
  );
}

export function pointerArea(opts: Omit<PointerAreaProps, "children">, children: UINode[]): UINode {
  return PointerArea({ ...opts, children });
}

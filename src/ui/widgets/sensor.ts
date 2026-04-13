/**
 * Sensor: detects visibility and size changes on child content.
 *
 * @module
 */

import type { Handler, UINode } from "../../types.js";
import { autoId, containerNodeWithMeta, extractHandlers, putIf } from "../build.js";
import type { A11y } from "../types.js";
import { encodeA11y } from "../types.js";

const _SENSOR_HANDLERS = { onResize: "resize" } as const;

/** Props for the Sensor widget. */
export interface SensorProps {
  /** Unique widget identifier. */
  id?: string;
  /** Debounce delay in milliseconds before emitting a resize event after the size stabilizes. */
  delay?: number;
  /** Extra pixels beyond the viewport to anticipate for lazy-loading content. */
  anticipate?: number;
  /** Accessibility properties. */
  a11y?: A11y;
  /** Maximum events per second for this widget's coalescable events. */
  eventRate?: number;
  /** Resize handler or boolean to enable resize events. Emits {width, height} data. */
  onResize?: Handler<unknown> | boolean;
  /** Child widgets whose size changes are detected. */
  children?: UINode[];
}

export function Sensor(props: SensorProps): UINode {
  const id = props.id ?? autoId("sensor");
  const children = props.children ?? [];
  const handlerProps: Record<string, string> = {};
  if (typeof props.onResize === "function") handlerProps["onResize"] = "resize";
  const { clean, meta } = extractHandlers(id, props, handlerProps);

  const p: Record<string, unknown> = {};
  putIf(p, clean.delay, "delay");
  putIf(p, clean.anticipate, "anticipate");
  putIf(p, clean.a11y, "a11y", encodeA11y);
  putIf(p, clean.eventRate, "event_rate");
  if (typeof props.onResize === "boolean") putIf(p, props.onResize, "on_resize");
  else if (typeof props.onResize === "function") p["on_resize"] = true;
  return containerNodeWithMeta(
    id,
    "sensor",
    p,
    Array.isArray(children) ? children : [children],
    meta,
  );
}

export function sensor(opts: Omit<SensorProps, "children">, children: UINode[]): UINode {
  return Sensor({ ...opts, children });
}

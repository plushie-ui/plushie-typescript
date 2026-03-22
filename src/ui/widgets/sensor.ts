/**
 * Sensor -- detects visibility and size changes on child content.
 *
 * @module
 */

import type { UINode, Handler } from "../../types.js"
import type { A11y } from "../types.js"
import { encodeA11y } from "../types.js"
import { containerNode, putIf, autoId, extractHandlers } from "../build.js"

const SENSOR_HANDLERS = { onResize: "resize" } as const

/** Props for the Sensor widget. */
export interface SensorProps {
  id?: string
  delay?: number
  anticipate?: number
  a11y?: A11y
  eventRate?: number
  onResize?: Handler<unknown> | boolean
  children?: UINode[]
}

export function Sensor(props: SensorProps): UINode {
  const id = props.id ?? autoId("sensor")
  const children = props.children ?? []
  const handlerProps: Record<string, string> = {}
  if (typeof props.onResize === "function") handlerProps["onResize"] = "resize"
  const clean = extractHandlers(id, props, handlerProps)

  const p: Record<string, unknown> = {}
  putIf(p, clean.delay, "delay")
  putIf(p, clean.anticipate, "anticipate")
  putIf(p, clean.a11y, "a11y", encodeA11y)
  putIf(p, clean.eventRate, "event_rate")
  if (typeof props.onResize === "boolean") putIf(p, props.onResize, "on_resize")
  else if (typeof props.onResize === "function") p["on_resize"] = true
  return containerNode(id, "sensor", p, Array.isArray(children) ? children : [children])
}

export function sensor(
  opts: Omit<SensorProps, "children">,
  children: UINode[],
): UINode {
  return Sensor({ ...opts, children })
}

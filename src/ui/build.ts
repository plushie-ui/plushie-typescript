/**
 * Widget builder utilities.
 *
 * Provides helpers for creating UINodes with typed props, optional
 * fields (nil-omission), and handler registration.
 *
 * @module
 */

import type { UINode, Handler } from "../types.js"
import { registerHandler } from "./handlers.js"
import { autoId } from "../tree/node.js"

/**
 * Add a prop to the accumulator only if the value is not undefined.
 * This mirrors the Elixir `put_if/3` pattern -- undefined props are
 * omitted from the wire message entirely.
 */
export function putIf(
  props: Record<string, unknown>,
  value: unknown,
  key: string,
  encode?: (v: never) => unknown,
): Record<string, unknown> {
  if (value !== undefined) {
    props[key] = encode ? encode(value as never) : value
  }
  return props
}

/**
 * Build a leaf UINode (no children).
 *
 * @param id - Widget ID.
 * @param type - Wire type string (e.g., "button", "text").
 * @param props - Wire-ready props (already encoded).
 * @returns Frozen UINode.
 */
export function leafNode(
  id: string,
  type: string,
  props: Record<string, unknown>,
): UINode {
  return Object.freeze({
    id,
    type,
    props: Object.freeze(props),
    children: Object.freeze([]) as readonly UINode[],
  })
}

/**
 * Build a container UINode (has children).
 *
 * @param id - Widget ID.
 * @param type - Wire type string (e.g., "column", "row").
 * @param props - Wire-ready props (already encoded).
 * @param children - Child UINodes.
 * @returns Frozen UINode.
 */
export function containerNode(
  id: string,
  type: string,
  props: Record<string, unknown>,
  children: UINode[],
): UINode {
  return Object.freeze({
    id,
    type,
    props: Object.freeze(props),
    children: Object.freeze(children),
  })
}

/**
 * Register handlers from an options object for a widget.
 * Extracts `onXxx` props, registers them, and returns the
 * remaining non-handler props.
 *
 * @param widgetId - The widget's ID.
 * @param opts - Raw options that may include handler props.
 * @param handlerMap - Map of handler prop names to wire event types.
 * @returns Options with handler props removed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractHandlers<T>(
  widgetId: string,
  opts: T,
  handlerMap: Record<string, string>,
): T {
  const clean = { ...opts } as Record<string, unknown>
  for (const [propName, eventType] of Object.entries(handlerMap)) {
    const handler = clean[propName]
    if (typeof handler === "function") {
      registerHandler(widgetId, eventType, handler as Handler<unknown>)
    }
    delete clean[propName]
  }
  return clean as T
}

/**
 * Generate an auto-ID for display widgets that don't need explicit IDs.
 */
export { autoId }

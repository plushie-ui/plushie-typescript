/**
 * Extension widget support.
 *
 * Provides `defineExtensionWidget` for creating widget builder
 * functions for extension types. This is the TypeScript equivalent
 * of `use Plushie.Extension` from the Elixir SDK -- not a macro
 * system, but a function that generates typed widget builders.
 *
 * @module
 */

import type { UINode, Handler } from "./types.js"
import { registerHandler } from "./ui/handlers.js"
import { autoId } from "./tree/node.js"

/** Supported property types for extension widget props. */
export type ExtensionPropType = "string" | "number" | "boolean" | "any"

/** Configuration for defining an extension widget. */
export interface ExtensionWidgetConfig {
  /** Wire type name for the extension (e.g., "sparkline", "color_wheel"). */
  readonly type: string
  /** Declared props with their types. Values are validated at build time. */
  readonly props?: Readonly<Record<string, ExtensionPropType>>
  /** Event names this widget can emit (e.g., ["change", "hover"]). */
  readonly events?: readonly string[]
}

/**
 * Handler prop name for an event type.
 * "click" -> "onClick", "value_change" -> "onValueChange"
 */
function handlerPropName(eventType: string): string {
  const camel = eventType.replace(/_([a-z])/g, (_match, letter: string) =>
    letter.toUpperCase(),
  )
  return `on${camel.charAt(0).toUpperCase()}${camel.slice(1)}`
}

/**
 * Define an extension widget builder.
 *
 * Returns a function that creates UINodes with the extension's wire
 * type and registers event handlers using the same mechanism as
 * built-in widgets.
 *
 * ```ts
 * const sparkline = defineExtensionWidget({
 *   type: "sparkline",
 *   props: { values: "any", color: "string", height: "number" },
 *   events: ["hover"],
 * })
 *
 * // Use in view:
 * sparkline("chart", { values: [1, 2, 3], onHover: handleHover })
 * ```
 */
export function defineExtensionWidget(
  config: ExtensionWidgetConfig,
): (id: string, opts?: Record<string, unknown>) => UINode {
  const widgetType = config.type
  const declaredProps = config.props ?? {}
  const declaredEvents = config.events ?? []

  // Build handler prop name -> wire event type mapping
  const handlerMap = new Map<string, string>()
  for (const eventType of declaredEvents) {
    handlerMap.set(handlerPropName(eventType), eventType)
  }

  return (id: string, opts?: Record<string, unknown>): UINode => {
    const resolvedId = id === "" ? autoId(widgetType) : id
    const props: Record<string, unknown> = {}
    const allOpts = opts ?? {}

    for (const [key, value] of Object.entries(allOpts)) {
      if (value === undefined) continue

      // Check if this is a handler prop
      const eventType = handlerMap.get(key)
      if (eventType !== undefined) {
        if (typeof value === "function") {
          registerHandler(resolvedId, eventType, value as Handler<unknown>)
        }
        continue
      }

      // Regular prop -- include in wire props
      props[key] = value
    }

    return Object.freeze({
      id: resolvedId,
      type: widgetType,
      props: Object.freeze(props),
      children: Object.freeze([]) as readonly UINode[],
    })
  }
}

/**
 * Extension widget support.
 *
 * Provides `defineExtensionWidget` for creating widget builder
 * functions for extension types, and `extensionCommands` for
 * generating Command constructors from extension config.
 *
 * This is the TypeScript equivalent of `use Plushie.Extension`
 * from the Elixir SDK -- not a macro system, but a function that
 * generates typed widget builders and command constructors.
 *
 * @module
 */

import { autoId } from "./tree/node.js";
import type { Command, Handler, UINode } from "./types.js";
import { COMMAND } from "./types.js";
import { registerHandler } from "./ui/handlers.js";

/**
 * Supported property types for extension widget props.
 *
 * Mirrors the Elixir SDK's extension prop types:
 * - Primitives: "string", "number", "boolean"
 * - Plushie types: "color", "length", "padding", "alignment", "font", "style"
 * - Generic: "any"
 * - Compound: { list: <element-type> }
 */
export type ExtensionPropType =
  | "string"
  | "number"
  | "boolean"
  | "color"
  | "length"
  | "padding"
  | "alignment"
  | "font"
  | "style"
  | "any"
  | { readonly list: ExtensionPropType };

/** Configuration for defining an extension widget. */
export interface ExtensionWidgetConfig {
  /** Wire type name for the extension (e.g., "sparkline", "color_wheel"). */
  readonly type: string;
  /** Declared props with their types. Values are validated at build time. */
  readonly props?: Readonly<Record<string, ExtensionPropType>>;
  /** Event names this widget can emit (e.g., ["change", "hover"]). */
  readonly events?: readonly string[];
  /** If true, the widget accepts children (container widget). */
  readonly container?: boolean;
  /** Command names this extension supports (native_widget only). */
  readonly commands?: readonly string[];
  /**
   * Path to the Rust crate for native widget extensions (relative to project root).
   * Required for `npx plushie build` to include this extension in the custom binary.
   * The crate must implement the `WidgetExtension` trait from `plushie_core`.
   */
  readonly rustCrate?: string;
  /**
   * Rust constructor expression for registering the extension.
   * Called in the generated main.rs via `.extension(constructor)`.
   * Example: `"MyExtension::new()"` or `"sparkline::SparklineExtension::new()"`
   */
  readonly rustConstructor?: string;
}

/**
 * Handler prop name for an event type.
 * "click" -> "onClick", "value_change" -> "onValueChange"
 */
function handlerPropName(eventType: string): string {
  const camel = eventType.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
  return `on${camel.charAt(0).toUpperCase()}${camel.slice(1)}`;
}

/**
 * Define an extension widget builder.
 *
 * Returns a function that creates UINodes with the extension's wire
 * type and registers event handlers using the same mechanism as
 * built-in widgets.
 *
 * For leaf widgets (container is false or omitted):
 * ```ts
 * const sparkline = defineExtensionWidget({
 *   type: "sparkline",
 *   props: { values: "any", color: "color", height: "number" },
 *   events: ["hover"],
 * })
 *
 * // Use in view:
 * sparkline("chart", { values: [1, 2, 3], onHover: handleHover })
 * ```
 *
 * For container widgets:
 * ```ts
 * const panel = defineExtensionWidget({
 *   type: "panel",
 *   props: { title: "string" },
 *   container: true,
 * })
 *
 * // Use in view (children as third argument):
 * panel("main", { title: "Content" }, [text("greeting", "Hello")])
 * ```
 */
export function defineExtensionWidget(
  config: ExtensionWidgetConfig,
): (id: string, opts?: Record<string, unknown>, children?: UINode[]) => UINode {
  const widgetType = config.type;
  const declaredEvents = config.events ?? [];
  const isContainer = config.container ?? false;

  // Build handler prop name -> wire event type mapping
  const handlerMap = new Map<string, string>();
  for (const eventType of declaredEvents) {
    handlerMap.set(handlerPropName(eventType), eventType);
  }

  return (id: string, opts?: Record<string, unknown>, children?: UINode[]): UINode => {
    const resolvedId = id === "" ? autoId(widgetType) : id;
    const props: Record<string, unknown> = {};
    const allOpts = opts ?? {};

    for (const [key, value] of Object.entries(allOpts)) {
      if (value === undefined) continue;

      // Check if this is a handler prop
      const eventType = handlerMap.get(key);
      if (eventType !== undefined) {
        if (typeof value === "function") {
          registerHandler(resolvedId, eventType, value as Handler<unknown>);
        }
        continue;
      }

      // Regular prop -- include in wire props
      props[key] = value;
    }

    const resolvedChildren = isContainer ? (children ?? []) : [];

    return Object.freeze({
      id: resolvedId,
      type: widgetType,
      props: Object.freeze(props),
      children: Object.freeze(resolvedChildren) as readonly UINode[],
    });
  };
}

/**
 * Generate Command constructor functions for an extension's declared commands.
 *
 * Each command becomes a function that takes a node ID and optional payload,
 * returning a Command that the runtime sends as an extension_command message.
 *
 * ```ts
 * const gaugeConfig = {
 *   type: "gauge",
 *   props: { value: "number" },
 *   commands: ["set_value", "reset"],
 * } as const
 *
 * const gauge = defineExtensionWidget(gaugeConfig)
 * const cmds = extensionCommands(gaugeConfig)
 * // cmds.set_value("my-gauge", { value: 42 })
 * // cmds.reset("my-gauge")
 * ```
 */
export function extensionCommands(
  config: ExtensionWidgetConfig,
): Record<string, (nodeId: string, payload?: Record<string, unknown>) => Command> {
  const cmds: Record<string, (nodeId: string, payload?: Record<string, unknown>) => Command> = {};

  for (const cmdName of config.commands ?? []) {
    cmds[cmdName] = (nodeId: string, payload: Record<string, unknown> = {}): Command =>
      Object.freeze({
        [COMMAND]: true as const,
        type: "extension_command",
        payload: Object.freeze({ node_id: nodeId, op: cmdName, payload }),
      });
  }

  return cmds;
}

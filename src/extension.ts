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

import type { UINode, Command, Handler } from "./types.js"
import { COMMAND } from "./types.js"
import { registerHandler } from "./ui/handlers.js"
import { autoId } from "./tree/node.js"

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
  | { list: string }

/** Configuration for defining an extension widget. */
export interface ExtensionWidgetConfig {
  /** Wire type name for the extension (e.g., "sparkline", "color_wheel"). */
  readonly type: string
  /** Declared props with their types. Values are validated at build time. */
  readonly props?: Readonly<Record<string, ExtensionPropType>>
  /** Event names this widget can emit (e.g., ["change", "hover"]). */
  readonly events?: readonly string[]
  /** If true, the widget accepts children (container widget). */
  readonly container?: boolean
  /** Command names this extension supports (native_widget only). */
  readonly commands?: readonly string[]
  /**
   * Path to the Rust crate for native widget extensions (relative to project root).
   * Required for `npx plushie build` to include this extension in the custom binary.
   * The crate must implement the `WidgetExtension` trait from `plushie_core`.
   */
  readonly rustCrate?: string
  /**
   * Rust constructor expression for registering the extension.
   * Called in the generated main.rs via `.extension(constructor)`.
   * Example: `"MyExtension::new()"` or `"sparkline::SparklineExtension::new()"`
   */
  readonly rustConstructor?: string
}

/**
 * Configuration for building a custom plushie binary with extensions.
 * Used by the CLI `plushie build` command.
 */
export interface ExtensionBuildConfig {
  /** List of extension widget configs to include in the custom binary. */
  readonly extensions: readonly ExtensionWidgetConfig[]
  /** Path to the plushie Rust source checkout. */
  readonly sourcePath: string
  /** Custom binary name (defaults to "plushie-custom"). */
  readonly binaryName?: string
  /** Build in release mode. */
  readonly release?: boolean
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
  const widgetType = config.type
  const declaredEvents = config.events ?? []
  const isContainer = config.container ?? false

  // Build handler prop name -> wire event type mapping
  const handlerMap = new Map<string, string>()
  for (const eventType of declaredEvents) {
    handlerMap.set(handlerPropName(eventType), eventType)
  }

  return (id: string, opts?: Record<string, unknown>, children?: UINode[]): UINode => {
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

    const resolvedChildren = isContainer ? (children ?? []) : []

    return Object.freeze({
      id: resolvedId,
      type: widgetType,
      props: Object.freeze(props),
      children: Object.freeze(resolvedChildren) as readonly UINode[],
    })
  }
}

/**
 * Generate Command constructor functions for an extension's declared commands.
 *
 * Each command becomes a function that takes a node ID and optional payload,
 * returning a Command that the runtime sends as an extension_command message.
 *
 * ```ts
 * const gauge = defineExtensionWidget({
 *   type: "gauge",
 *   props: { value: "number" },
 *   commands: ["set_value", "reset"],
 * })
 *
 * const cmds = extensionCommands(gauge)
 * // cmds.set_value("my-gauge", { value: 42 })
 * // cmds.reset("my-gauge")
 * ```
 */
export function extensionCommands(
  config: ExtensionWidgetConfig,
): Record<string, (nodeId: string, payload?: Record<string, unknown>) => Command> {
  const cmds: Record<string, (nodeId: string, payload?: Record<string, unknown>) => Command> = {}

  for (const cmdName of config.commands ?? []) {
    cmds[cmdName] = (nodeId: string, payload: Record<string, unknown> = {}): Command =>
      Object.freeze({
        [COMMAND]: true as const,
        type: "extension_command",
        payload: Object.freeze({ node_id: nodeId, op: cmdName, payload }),
      })
  }

  return cmds
}

// =========================================================================
// Extension build workspace generation
// =========================================================================

/**
 * Validate extension configs for building a custom binary.
 *
 * Checks for:
 * - Every native extension has rustCrate and rustConstructor
 * - No two extensions use the same type name
 * - No two extensions use the same crate directory name
 *
 * @throws {Error} If validation fails.
 */
export function validateExtensions(extensions: readonly ExtensionWidgetConfig[]): void {
  // Check for native build fields
  const nativeExts = extensions.filter((e) => e.rustCrate || e.rustConstructor)
  for (const ext of nativeExts) {
    if (!ext.rustCrate) {
      throw new Error(`Extension "${ext.type}" has rustConstructor but no rustCrate`)
    }
    if (!ext.rustConstructor) {
      throw new Error(`Extension "${ext.type}" has rustCrate but no rustConstructor`)
    }
  }

  // Check for type name collisions
  const typeNames = new Map<string, string>()
  for (const ext of extensions) {
    const existing = typeNames.get(ext.type)
    if (existing !== undefined) {
      throw new Error(
        `Extension type name collision: "${ext.type}" is used by multiple extensions`,
      )
    }
    typeNames.set(ext.type, ext.type)
  }

  // Check for crate name collisions
  const crateNames = new Map<string, string>()
  for (const ext of nativeExts) {
    const crateName = ext.rustCrate!.split("/").pop() ?? ext.rustCrate!
    const existing = crateNames.get(crateName)
    if (existing !== undefined) {
      throw new Error(
        `Extension crate name collision: "${crateName}" is used by extensions ` +
        `"${existing}" and "${ext.type}". Rename one of the crate directories.`,
      )
    }
    crateNames.set(crateName, ext.type)
  }
}

/**
 * Generate Cargo.toml content for a custom extension build workspace.
 *
 * @param config - Build configuration.
 * @returns Cargo.toml content as a string.
 */
export function generateCargoToml(config: ExtensionBuildConfig): string {
  const binName = config.binaryName ?? "plushie-custom"
  const packageName = binName.replace(/-/g, "_")
  const nativeExts = config.extensions.filter((e) => e.rustCrate)

  const { resolve, relative, join, basename } = require("node:path") as typeof import("node:path")
  const buildDir = resolve("node_modules", ".plushie", "build")

  // Plushie core/bin dependencies -- use local source if available
  const plushieCoreRel = relative(buildDir, join(config.sourcePath, "plushie-core"))
  const plushieBinRel = relative(buildDir, join(config.sourcePath, "plushie"))
  const plushieCoreDep = `plushie-core = { path = "${plushieCoreRel}" }`
  const plushieBinDep = `plushie = { path = "${plushieBinRel}" }`

  // Extension crate dependencies
  const extDeps = nativeExts
    .map((ext) => {
      const cratePath = resolve(ext.rustCrate!)
      const relPath = relative(buildDir, cratePath)
      const crateName = basename(cratePath)
      return `${crateName} = { path = "${relPath}" }`
    })
    .join("\n")

  return `[package]
name = "${packageName}"
version = "0.1.0"
edition = "2024"

[[bin]]
name = "${binName}"
path = "src/main.rs"

[dependencies]
${plushieCoreDep}
${plushieBinDep}
${extDeps}
`
}

/**
 * Generate main.rs content for a custom extension build.
 *
 * @param extensions - Extension configs with rustConstructor.
 * @returns main.rs content as a string.
 */
export function generateMainRs(extensions: readonly ExtensionWidgetConfig[]): string {
  const nativeExts = extensions.filter((e) => e.rustConstructor)

  // Validate constructors (must be valid Rust identifiers/paths)
  const constructorPattern = /^[A-Za-z_][A-Za-z0-9_:]*(\([^)]*\))?$/
  for (const ext of nativeExts) {
    if (!constructorPattern.test(ext.rustConstructor!)) {
      throw new Error(
        `Extension "${ext.type}" rustConstructor "${ext.rustConstructor}" ` +
        `contains invalid characters. Expected a Rust identifier, path (::), ` +
        `or simple invocation (e.g. "MyExt::new()")`,
      )
    }
  }

  const registrations = nativeExts
    .map((ext) => `        .extension(${ext.rustConstructor})`)
    .join("\n")

  return `// Auto-generated by npx plushie build
// Do not edit manually.

use plushie_core::app::PlushieAppBuilder;

fn main() -> iced::Result {
    let builder = PlushieAppBuilder::new()
${registrations};
    plushie::run(builder)
}
`
}

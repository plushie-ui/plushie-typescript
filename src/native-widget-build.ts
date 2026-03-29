/**
 * Build-time native widget functions.
 *
 * These functions generate Cargo workspace files for building custom
 * plushie binaries with native widget extensions. They require Node.js
 * (node:path) and are NOT safe to import in browser bundles.
 *
 * Runtime native widget support (defineNativeWidget, nativeWidgetCommands)
 * lives in native-widget.ts and is browser-safe.
 *
 * @module
 */

import * as nodePath from "node:path";
import type { NativeWidgetConfig } from "./native-widget.js";

/**
 * Configuration for building a custom plushie binary with native widgets.
 * Used by the CLI `plushie build` command.
 */
export interface NativeWidgetBuildConfig {
  /** List of native widget configs to include in the custom binary. */
  readonly extensions: readonly NativeWidgetConfig[];
  /** Path to the plushie Rust source checkout. If omitted, uses published crates. */
  readonly sourcePath?: string;
  /** Custom binary name (defaults to "plushie-custom"). */
  readonly binaryName?: string;
  /** Build in release mode. */
  readonly release?: boolean;
}

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
export function validateExtensions(extensions: readonly NativeWidgetConfig[]): void {
  // Check for native build fields
  const nativeExts = extensions.filter((e) => e.rustCrate || e.rustConstructor);
  for (const ext of nativeExts) {
    if (!ext.rustCrate) {
      throw new Error(`Extension "${ext.type}" has rustConstructor but no rustCrate`);
    }
    if (!ext.rustConstructor) {
      throw new Error(`Extension "${ext.type}" has rustCrate but no rustConstructor`);
    }
  }

  // Check for type name collisions
  const typeNames = new Map<string, string>();
  for (const ext of extensions) {
    const existing = typeNames.get(ext.type);
    if (existing !== undefined) {
      throw new Error(
        `Extension type name collision: "${ext.type}" is used by multiple extensions`,
      );
    }
    typeNames.set(ext.type, ext.type);
  }

  // Check for crate name collisions
  const crateNames = new Map<string, string>();
  for (const ext of nativeExts) {
    const crateName = ext.rustCrate!.split("/").pop() ?? ext.rustCrate!;
    const existing = crateNames.get(crateName);
    if (existing !== undefined) {
      throw new Error(
        `Extension crate name collision: "${crateName}" is used by extensions ` +
          `"${existing}" and "${ext.type}". Rename one of the crate directories.`,
      );
    }
    crateNames.set(crateName, ext.type);
  }
}

/**
 * Generate Cargo.toml content for a custom extension build workspace.
 *
 * @param config - Build configuration.
 * @returns Cargo.toml content as a string.
 */
export function generateCargoToml(config: NativeWidgetBuildConfig): string {
  const binName = config.binaryName ?? "plushie-custom";
  const packageName = binName.replace(/-/g, "_");
  const nativeExts = config.extensions.filter((e) => e.rustCrate);

  const buildDir = nodePath.resolve("node_modules", ".plushie", "build");

  // Plushie dependencies -- use local source if available, otherwise crates.io
  let plushieExtDep: string;
  let plushieRendererDep: string;

  if (config.sourcePath) {
    const plushieExtRel = nodePath.relative(
      buildDir,
      nodePath.join(config.sourcePath, "plushie-ext"),
    );
    const plushieRendererRel = nodePath.relative(
      buildDir,
      nodePath.join(config.sourcePath, "plushie-renderer"),
    );
    plushieExtDep = `plushie-ext = { path = "${plushieExtRel}" }`;
    plushieRendererDep = `plushie-renderer = { path = "${plushieRendererRel}" }`;
  } else {
    // Use published crates from crates.io
    plushieExtDep = `plushie-ext = "0.5"`;
    plushieRendererDep = `plushie-renderer = "0.5"`;
  }

  // Extension crate dependencies
  const extDeps = nativeExts
    .map((ext) => {
      const cratePath = nodePath.resolve(ext.rustCrate!);
      const relPath = nodePath.relative(buildDir, cratePath);
      const crateName = nodePath.basename(cratePath);
      return `${crateName} = { path = "${relPath}" }`;
    })
    .join("\n");

  return `[package]
name = "${packageName}"
version = "0.1.0"
edition = "2024"

[[bin]]
name = "${binName}"
path = "src/main.rs"

[dependencies]
${plushieExtDep}
${plushieRendererDep}
${extDeps}
`;
}

/**
 * Generate main.rs content for a custom extension build.
 *
 * @param extensions - Extension configs with rustConstructor.
 * @returns main.rs content as a string.
 */
export function generateMainRs(extensions: readonly NativeWidgetConfig[]): string {
  const nativeExts = extensions.filter((e) => e.rustConstructor);

  // Validate constructors (must be valid Rust identifiers/paths)
  const constructorPattern = /^[A-Za-z_][A-Za-z0-9_:]*(\([^)]*\))?$/;
  for (const ext of nativeExts) {
    if (!constructorPattern.test(ext.rustConstructor!)) {
      throw new Error(
        `Extension "${ext.type}" rustConstructor "${ext.rustConstructor}" ` +
          `contains invalid characters. Expected a Rust identifier, path (::), ` +
          `or simple invocation (e.g. "MyExt::new()")`,
      );
    }
  }

  const registrations = nativeExts
    .map((ext) => `        .extension(${ext.rustConstructor})`)
    .join("\n");

  return `// Auto-generated by npx plushie build
// Do not edit manually.

use plushie_ext::app::PlushieAppBuilder;

fn main() -> plushie_ext::iced::Result {
    let builder = PlushieAppBuilder::new()
${registrations};
    plushie_renderer::run(builder)
}
`;
}

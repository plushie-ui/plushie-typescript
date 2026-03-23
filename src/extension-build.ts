/**
 * Build-time extension functions.
 *
 * These functions generate Cargo workspace files for building custom
 * plushie binaries with native widget extensions. They require Node.js
 * (node:path) and are NOT safe to import in browser bundles.
 *
 * Runtime extension support (defineExtensionWidget, extensionCommands)
 * lives in extension.ts and is browser-safe.
 *
 * @module
 */

import * as nodePath from "node:path";
import type { ExtensionWidgetConfig } from "./extension.js";

/**
 * Configuration for building a custom plushie binary with extensions.
 * Used by the CLI `plushie build` command.
 */
export interface ExtensionBuildConfig {
  /** List of extension widget configs to include in the custom binary. */
  readonly extensions: readonly ExtensionWidgetConfig[];
  /** Path to the plushie Rust source checkout. */
  readonly sourcePath: string;
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
export function validateExtensions(extensions: readonly ExtensionWidgetConfig[]): void {
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
export function generateCargoToml(config: ExtensionBuildConfig): string {
  const binName = config.binaryName ?? "plushie-custom";
  const packageName = binName.replace(/-/g, "_");
  const nativeExts = config.extensions.filter((e) => e.rustCrate);

  const buildDir = nodePath.resolve("node_modules", ".plushie", "build");

  // Plushie core/bin dependencies -- use local source if available
  const plushieCoreRel = nodePath.relative(buildDir, nodePath.join(config.sourcePath, "plushie-core"));
  const plushieBinRel = nodePath.relative(buildDir, nodePath.join(config.sourcePath, "plushie"));
  const plushieCoreDep = `plushie-core = { path = "${plushieCoreRel}" }`;
  const plushieBinDep = `plushie = { path = "${plushieBinRel}" }`;

  // Extension crate dependencies
  const extDeps = nativeExts
    .map((ext) => {
      const cratePath = nodePath.resolve(ext.rustCrate!);
      const relPath = nodePath.relative(buildDir, cratePath);
      const crateName = nodePath.basename(cratePath);
      return `${crateName} = { path = "${relPath}" }`;
    })
    .join("\n");

  // The generated main.rs uses iced::Result, so we need iced as a dependency.
  // Use the same vendored fork that plushie-core uses.
  const icedDep = `iced = { version = "0.7", package = "plushie-iced" }`;

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
${icedDep}
${extDeps}
`;
}

/**
 * Generate main.rs content for a custom extension build.
 *
 * @param extensions - Extension configs with rustConstructor.
 * @returns main.rs content as a string.
 */
export function generateMainRs(extensions: readonly ExtensionWidgetConfig[]): string {
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

use plushie_core::app::PlushieAppBuilder;

fn main() -> iced::Result {
    let builder = PlushieAppBuilder::new()
${registrations};
    plushie::run(builder)
}
`;
}

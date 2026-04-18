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

import { existsSync, readFileSync } from "node:fs";
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

  // Check for built-in widget type name shadows
  const builtinTypes = new Set([
    "column",
    "row",
    "container",
    "stack",
    "grid",
    "pin",
    "keyed_column",
    "float",
    "responsive",
    "scrollable",
    "pane_grid",
    "text",
    "rich_text",
    "rich",
    "space",
    "rule",
    "progress_bar",
    "slider",
    "text_input",
    "text_editor",
    "button",
    "checkbox",
    "radio",
    "toggle",
    "dropdown",
    "pick_list",
    "combo_box",
    "tooltip",
    "image",
    "svg",
    "canvas",
    "table",
    "tab_bar",
    "horizontal_slider",
    "vertical_slider",
    "modal",
    "tooltip_area",
    "key_displayer",
  ]);
  const shadows: string[] = [];
  for (const ext of extensions) {
    if (builtinTypes.has(ext.type)) {
      shadows.push(ext.type);
    }
  }
  if (shadows.length > 0) {
    throw new Error(
      `Native widget type name shadows a built-in widget:\n` +
        shadows.join("\n") +
        "\n\nChoose a different type name. The iced widget set is registered first and handles these names.",
    );
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
 * Check plushie-widget-sdk version compatibility for each native widget crate.
 *
 * Reads each crate's Cargo.toml and warns (via callback) if its
 * plushie-widget-sdk dependency version doesn't match the expected version.
 * Handles version strings, table dependencies with version, and path
 * dependencies (reads version from the target Cargo.toml).
 *
 * @param extensions - Extension configs with rustCrate paths.
 * @param expectedVersion - Expected plushie-widget-sdk major.minor (e.g. "0.6").
 * @param warn - Callback for version mismatch warnings.
 */
export function checkExtensionVersions(
  extensions: readonly NativeWidgetConfig[],
  expectedVersion: string,
  warn: (message: string) => void,
): void {
  const nativeExts = extensions.filter((e) => e.rustCrate);

  for (const ext of nativeExts) {
    const cargoPath = nodePath.resolve(ext.rustCrate!, "Cargo.toml");
    if (!existsSync(cargoPath)) continue;

    let content: string;
    try {
      content = readFileSync(cargoPath, "utf-8");
    } catch {
      continue;
    }

    // Try: plushie-widget-sdk = "version"
    let match = content.match(/plushie-widget-sdk\s*=\s*"([^"]+)"/);
    if (!match) {
      // Try: plushie-widget-sdk = { version = "version", ... }
      match = content.match(/plushie-widget-sdk\s*=\s*\{[^}]*version\s*=\s*"([^"]+)"/);
    }
    if (!match) {
      // Try: plushie-widget-sdk = { path = "path", ... }; read version from target
      const pathMatch = content.match(/plushie-widget-sdk\s*=\s*\{[^}]*path\s*=\s*"([^"]+)"/);
      if (pathMatch) {
        const targetCargoPath = nodePath.resolve(ext.rustCrate!, pathMatch[1]!, "Cargo.toml");
        if (existsSync(targetCargoPath)) {
          try {
            const targetContent = readFileSync(targetCargoPath, "utf-8");
            const versionMatch = targetContent.match(/\[package\][^[]*version\s*=\s*"([^"]+)"/s);
            if (versionMatch) {
              match = versionMatch;
            }
          } catch {
            // Skip
          }
        }
      }
    }

    if (match?.[1]) {
      const depVersion = match[1];
      // Compare major.minor
      const depMajorMinor = depVersion.split(".").slice(0, 2).join(".");
      const expectedMajorMinor = expectedVersion.split(".").slice(0, 2).join(".");
      if (depMajorMinor !== expectedMajorMinor) {
        warn(
          `Widget "${ext.type}" depends on plushie-widget-sdk ${depVersion}, ` +
            `but this SDK targets ${expectedVersion}. Version mismatch may cause ` +
            `build failures or runtime incompatibilities.`,
        );
      }
    }
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

  // Plushie dependencies: use local source if available, otherwise crates.io
  let plushieWidgetSdkDep: string;
  let plushieRendererDep: string;

  if (config.sourcePath) {
    const plushieWidgetSdkRel = nodePath.relative(
      buildDir,
      nodePath.join(config.sourcePath, "crates", "plushie-widget-sdk"),
    );
    const plushieRendererRel = nodePath.relative(
      buildDir,
      nodePath.join(config.sourcePath, "crates", "plushie-renderer"),
    );
    plushieWidgetSdkDep = `plushie-widget-sdk = { path = "${plushieWidgetSdkRel}" }`;
    plushieRendererDep = `plushie-renderer = { path = "${plushieRendererRel}" }`;
  } else {
    // Use published crates from crates.io
    plushieWidgetSdkDep = `plushie-widget-sdk = "0.6"`;
    plushieRendererDep = `plushie-renderer = "0.6"`;
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

  // When using local source paths, add [patch.crates-io] so widget
  // crates that depend on plushie-widget-sdk from crates.io get redirected
  // to the same local checkout. Forward any additional [patch.crates-io]
  // entries from the renderer workspace's Cargo.toml and .cargo/config.toml
  // so the generated workspace shares the same local overrides (e.g. the
  // unreleased plushie-iced sibling checkout).
  const patchSection = config.sourcePath
    ? (() => {
        const widgetSdkRel = nodePath.relative(
          buildDir,
          nodePath.join(config.sourcePath, "crates", "plushie-widget-sdk"),
        );
        const rendererRel = nodePath.relative(
          buildDir,
          nodePath.join(config.sourcePath, "crates", "plushie-renderer"),
        );
        const extraPatches = rendererPatchEntries(config.sourcePath);
        const lines = [
          "",
          "",
          "[patch.crates-io]",
          `plushie-widget-sdk = { path = "${widgetSdkRel}" }`,
          `plushie-renderer = { path = "${rendererRel}" }`,
          ...extraPatches,
          "",
        ];
        return lines.join("\n");
      })()
    : "";

  return `[package]
name = "${packageName}"
version = "0.1.0"
edition = "2024"

[[bin]]
name = "${binName}"
path = "src/main.rs"

[dependencies]
${plushieWidgetSdkDep}
${plushieRendererDep}
${extDeps}${patchSection}`;
}

/**
 * Read [patch.crates-io] entries from the renderer workspace's
 * `Cargo.toml` and `.cargo/config.toml` (local-only dev overrides,
 * gitignored), returning patch lines with paths resolved against the
 * renderer root. Entries for plushie-widget-sdk and plushie-renderer
 * are skipped (already added as explicit patches above).
 */
function rendererPatchEntries(sourcePath: string): string[] {
  const files = [
    nodePath.join(sourcePath, "Cargo.toml"),
    nodePath.join(sourcePath, ".cargo", "config.toml"),
  ];

  const lines: string[] = [];
  const seen = new Set<string>();

  for (const file of files) {
    if (!existsSync(file)) continue;

    let content: string;
    try {
      content = readFileSync(file, "utf-8");
    } catch {
      continue;
    }

    for (const [name, relPath] of parseCargoPatchEntries(content)) {
      if (name === "plushie-widget-sdk" || name === "plushie-renderer") continue;
      if (seen.has(name)) continue;
      const resolved = nodePath.resolve(sourcePath, relPath);
      if (!existsSync(resolved)) continue;
      lines.push(`${name} = { path = "${resolved}" }`);
      seen.add(name);
    }
  }

  return lines;
}

/**
 * Parse [patch.crates-io] path entries from a Cargo.toml / config.toml
 * string. Returns pairs of [crate_name, relative_path].
 */
function parseCargoPatchEntries(content: string): Array<[string, string]> {
  const entries: Array<[string, string]> = [];
  let inSection = false;

  for (const raw of content.split("\n")) {
    const line = raw.trim();

    if (line === "[patch.crates-io]") {
      inSection = true;
      continue;
    }

    if (inSection && line.startsWith("[")) {
      inSection = false;
      continue;
    }

    if (!inSection) continue;

    const match = line.match(/^(\S+)\s*=\s*\{[^}]*path\s*=\s*"([^"]+)"/);
    if (match?.[1] && match[2]) {
      entries.push([match[1], match[2]]);
    }
  }

  return entries;
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
  // Allow turbofish generics: MyExt::<Config>::new()
  const constructorPattern = /^[A-Za-z_][A-Za-z0-9_:<>, ]*(\([^)]*\))?$/;
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
    .map((ext) => `        .widget(${ext.rustConstructor})`)
    .join("\n");

  return `// Auto-generated by npx plushie build
// Do not edit manually.

use plushie_widget_sdk::app::PlushieAppBuilder;

fn main() -> plushie_widget_sdk::iced::Result {
    let builder = PlushieAppBuilder::new()
${registrations};
    plushie_renderer::run(builder)
}
`;
}

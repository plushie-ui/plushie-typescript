/**
 * Plushie binary path resolution and download.
 *
 * The plushie binary is a hard requirement -- without it, nothing
 * works. This module resolves the binary path using a priority-based
 * lookup, and provides a download function for fetching precompiled
 * binaries.
 *
 * ## Resolution order
 *
 * 1. `PLUSHIE_BINARY_PATH` env var (must exist, error if file missing)
 * 2. SEA-bundled binary (if running in Node.js Single Executable context)
 * 3. Downloaded binary at `node_modules/.plushie/bin/<name>`
 * 4. Common local paths: `./plushie`, `../plushie/target/release/plushie`
 * 5. Error with guidance to download
 *
 * @module
 */

import { existsSync } from "node:fs"
import { join, resolve } from "node:path"
import { platform, arch } from "node:process"
import { isSEA, extractBinaryFromSEA } from "../sea.js"

/**
 * Map Node.js platform/arch to plushie binary naming convention.
 *
 * @returns Platform-specific binary name (e.g., "plushie-linux-x86_64").
 */
export function platformBinaryName(): string {
  const os = platformOs()
  const cpu = platformArch()
  const ext = os === "windows" ? ".exe" : ""
  return `plushie-${os}-${cpu}${ext}`
}

function platformOs(): string {
  switch (platform) {
    case "darwin": return "darwin"
    case "linux": return "linux"
    case "win32": return "windows"
    default: return platform
  }
}

function platformArch(): string {
  switch (arch) {
    case "x64": return "x86_64"
    case "arm64": return "aarch64"
    default: return arch
  }
}

/**
 * Resolve the path to the plushie binary.
 *
 * Checks each resolution level in order and returns the first
 * existing binary path. Throws with a helpful message if no
 * binary is found.
 *
 * @returns Absolute path to the plushie binary.
 * @throws {Error} If no binary is found at any resolution level.
 */
export function resolveBinary(): string {
  // 1. Environment variable override
  const envPath = process.env["PLUSHIE_BINARY_PATH"]
  if (envPath) {
    const resolved = resolve(envPath)
    if (!existsSync(resolved)) {
      throw new Error(
        `PLUSHIE_BINARY_PATH is set to "${envPath}" but the file does not exist.\n` +
        `Check the path or unset PLUSHIE_BINARY_PATH to use automatic resolution.`,
      )
    }
    return resolved
  }

  // 2. SEA-bundled binary (if running in a Node.js Single Executable)
  if (isSEA()) {
    try {
      return extractBinaryFromSEA()
    } catch {
      // Asset not bundled; fall through to filesystem checks
    }
  }

  // 3. Downloaded binary in node_modules
  const downloadDir = resolve("node_modules", ".plushie", "bin")
  const downloadPath = join(downloadDir, platformBinaryName())
  if (existsSync(downloadPath)) {
    return downloadPath
  }

  // 4. Common local paths (for development against local builds)
  const localPaths = [
    resolve("plushie"),
    resolve("..", "plushie", "target", "release", "plushie"),
    resolve("..", "plushie", "target", "debug", "plushie"),
  ]
  for (const p of localPaths) {
    if (existsSync(p)) return p
  }

  // 5. Not found
  throw new Error(
    `Could not find the plushie binary.\n\n` +
    `To fix this, either:\n` +
    `  - Set PLUSHIE_BINARY_PATH to point to a local build\n` +
    `  - Run: npx plushie download\n\n` +
    `Expected binary name: ${platformBinaryName()}\n` +
    `Checked: ${downloadPath}`,
  )
}

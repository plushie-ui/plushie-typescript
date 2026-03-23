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

import { existsSync, mkdirSync, createWriteStream, chmodSync } from "node:fs"
import { join, resolve, dirname } from "node:path"
import { platform, arch } from "node:process"
import { get as httpsGet } from "node:https"
import { isSEA, extractBinaryFromSEA } from "../sea.js"

/** Binary version matching this SDK release. */
export const BINARY_VERSION = "0.4.1"

/** GitHub release base URL. */
export const RELEASE_BASE_URL = "https://github.com/plushie-ui/plushie/releases/download"

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
    validateArchitecture(downloadPath)
    return downloadPath
  }

  // 4. Common local paths (for development against local builds)
  const localPaths = [
    resolve("plushie"),
    resolve("..", "plushie", "target", "release", "plushie"),
    resolve("..", "plushie", "target", "debug", "plushie"),
  ]
  for (const p of localPaths) {
    if (existsSync(p)) {
      validateArchitecture(p)
      return p
    }
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

/**
 * Validate that the binary matches the current system architecture.
 * Best-effort: silently succeeds if the `file` command is unavailable.
 *
 * @throws {Error} If the binary architecture doesn't match the system.
 */
export function validateArchitecture(binaryPath: string): void {
  try {
    const { execSync } = require("node:child_process") as typeof import("node:child_process")
    const output = execSync(`file "${binaryPath}"`, { encoding: "utf-8" })

    const is64 = output.includes("x86-64") || output.includes("x86_64") || output.includes("amd64")
    const isArm = output.includes("aarch64") || output.includes("arm64") || output.includes("ARM aarch64")

    const systemArch = process.arch // "x64" or "arm64"

    if (systemArch === "x64" && isArm && !is64) {
      throw new Error(
        `Architecture mismatch: binary is ARM64 but system is x86_64.\n` +
        `Download the correct binary: ${platformBinaryName()}`,
      )
    }
    if (systemArch === "arm64" && is64 && !isArm) {
      throw new Error(
        `Architecture mismatch: binary is x86_64 but system is ARM64.\n` +
        `Download the correct binary: ${platformBinaryName()}`,
      )
    }
  } catch (err) {
    // If it's our own Error, re-throw
    if (err instanceof Error && err.message.includes("Architecture mismatch")) throw err
    // Otherwise silently succeed (file command not available)
  }
}

/**
 * Download the precompiled plushie binary for the current platform.
 *
 * @param opts.destDir - Destination directory. Defaults to node_modules/.plushie/bin/
 * @param opts.force - Re-download even if binary already exists.
 * @returns Path to the downloaded binary.
 */
export async function downloadBinary(opts?: {
  destDir?: string
  force?: boolean
}): Promise<string> {
  const name = platformBinaryName()
  const destDir = opts?.destDir ?? resolve("node_modules", ".plushie", "bin")
  const destPath = join(destDir, name)
  const url = `${RELEASE_BASE_URL}/v${BINARY_VERSION}/${name}`

  if (!opts?.force && existsSync(destPath)) return destPath

  mkdirSync(destDir, { recursive: true })

  await new Promise<void>((res, rej) => {
    const follow = (currentUrl: string, depth = 0) => {
      if (depth > 5) {
        rej(new Error("Too many redirects"))
        return
      }
      httpsGet(currentUrl, { headers: { "User-Agent": "plushie-ts-sdk" } }, (response) => {
        if ((response.statusCode === 301 || response.statusCode === 302) && response.headers["location"]) {
          follow(response.headers["location"], depth + 1)
          return
        }
        if (response.statusCode !== 200) {
          rej(new Error(`HTTP ${String(response.statusCode)} downloading ${currentUrl}`))
          return
        }
        const dir = dirname(destPath)
        mkdirSync(dir, { recursive: true })
        const file = createWriteStream(destPath)
        response.pipe(file)
        file.on("finish", () => {
          file.close()
          res()
        })
        file.on("error", rej)
      }).on("error", rej)
    }
    follow(url)
  })

  if (process.platform !== "win32") chmodSync(destPath, 0o755)

  return destPath
}

#!/usr/bin/env node

/**
 * CLI entry point for the plushie SDK.
 *
 * Commands:
 *   plushie download       -- download the precompiled binary
 *   plushie download --wasm -- download the WASM renderer
 *   plushie dev <app>      -- run an app with file watching
 *   plushie run <app>      -- run an app
 *   plushie --help         -- print usage
 *   plushie --version      -- print version
 *
 * @module
 */

import { createRequire } from "node:module"
import { existsSync, mkdirSync, createWriteStream, chmodSync, readFileSync } from "node:fs"
import { resolve, join, dirname } from "node:path"
import { get as httpsGet } from "node:https"
import { spawnSync, spawn } from "node:child_process"
import { platformBinaryName } from "../client/binary.js"
import { DEFAULT_WASM_DIR, WASM_JS_FILE, WASM_BG_FILE } from "../wasm.js"

/** Binary version matching this SDK release. */
const BINARY_VERSION = "0.4.1"

/** GitHub release download base URL. */
const BASE_URL = "https://github.com/plushie-ui/plushie/releases/download"

function readVersion(): string {
  const require = createRequire(import.meta.url)
  const pkg = require("../../package.json") as { version: string }
  return pkg.version
}

const USAGE = `\
Usage: plushie <command> [options]

Commands:
  download          Download the precompiled plushie binary
  download --wasm   Download the WASM renderer
  dev <app>         Run an app with file watching (hot reload)
  run <app>         Run an app

Options:
  --help            Show this help message
  --version         Show version number
  --json            Use JSON wire format (default: msgpack)
  --binary <path>   Override binary path`

// =========================================================================
// Download
// =========================================================================

/**
 * Follow redirects and download a URL to a file.
 * GitHub releases redirect to S3, so we need to follow 302s.
 */
function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const follow = (currentUrl: string, depth = 0) => {
      if (depth > 5) {
        reject(new Error("Too many redirects"))
        return
      }

      httpsGet(currentUrl, { headers: { "User-Agent": "plushie-ts-sdk" } }, (res) => {
        // Follow redirects
        if ((res.statusCode === 301 || res.statusCode === 302) && res.headers["location"]) {
          follow(res.headers["location"], depth + 1)
          return
        }

        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${String(res.statusCode)} downloading ${currentUrl}`))
          return
        }

        const dir = dirname(destPath)
        mkdirSync(dir, { recursive: true })

        const file = createWriteStream(destPath)
        res.pipe(file)
        file.on("finish", () => {
          file.close()
          resolve()
        })
        file.on("error", reject)
      }).on("error", reject)
    }

    follow(url)
  })
}

/**
 * Download a file and verify its SHA256 checksum.
 */
async function downloadWithChecksum(url: string, destPath: string, label: string): Promise<void> {
  const checksumUrl = `${url}.sha256`

  process.stdout.write(`  Downloading ${label}...`)
  await downloadFile(url, destPath)
  console.log(" done")

  // Download and verify checksum
  try {
    const checksumPath = `${destPath}.sha256`
    await downloadFile(checksumUrl, checksumPath)

    const { createHash } = await import("node:crypto")
    const fileData = readFileSync(destPath)
    const actualHash = createHash("sha256").update(fileData).digest("hex")
    const expectedHash = readFileSync(checksumPath, "utf-8").trim().split(/\s+/)[0] ?? ""

    if (actualHash !== expectedHash) {
      console.error(`  WARNING: SHA256 mismatch for ${label}`)
      console.error(`    expected: ${expectedHash}`)
      console.error(`    actual:   ${actualHash}`)
    } else {
      console.log(`  SHA256 verified: ${actualHash.slice(0, 16)}...`)
    }
  } catch {
    // Checksum verification is best-effort
    console.log("  (checksum verification skipped)")
  }
}

async function handleDownload(flags: string[]): Promise<void> {
  const isWasm = flags.includes("--wasm")
  const force = flags.includes("--force")

  if (isWasm) {
    await downloadWasm(force)
  } else {
    await downloadBinary(force)
  }
}

async function downloadBinary(force: boolean): Promise<void> {
  const binaryName = platformBinaryName()
  const destDir = resolve("node_modules", ".plushie", "bin")
  const destPath = join(destDir, binaryName)
  const url = `${BASE_URL}/v${BINARY_VERSION}/${binaryName}`

  if (!force && existsSync(destPath)) {
    console.log(`Binary already exists at ${destPath}`)
    console.log("Use --force to re-download.")
    return
  }

  console.log(`Downloading plushie binary v${BINARY_VERSION}`)
  console.log(`  Platform: ${binaryName}`)
  console.log(`  From: ${url}`)
  console.log()

  await downloadWithChecksum(url, destPath, binaryName)

  // Make executable on Unix
  if (process.platform !== "win32") {
    chmodSync(destPath, 0o755)
    console.log("  Made executable (chmod +x)")
  }

  console.log()
  console.log(`Binary installed to ${destPath}`)
}

async function downloadWasm(force: boolean): Promise<void> {
  const destDir = resolve(DEFAULT_WASM_DIR)
  const tarUrl = `${BASE_URL}/v${BINARY_VERSION}/plushie-wasm.tar.gz`
  const tarPath = join(destDir, "plushie-wasm.tar.gz")

  if (!force && existsSync(join(destDir, WASM_JS_FILE)) && existsSync(join(destDir, WASM_BG_FILE))) {
    console.log(`WASM files already exist in ${destDir}`)
    console.log("Use --force to re-download.")
    return
  }

  console.log(`Downloading plushie WASM renderer v${BINARY_VERSION}`)
  console.log(`  From: ${tarUrl}`)
  console.log()

  await downloadWithChecksum(tarUrl, tarPath, "plushie-wasm.tar.gz")

  // Extract tar.gz
  console.log("  Extracting...")
  const { execSync } = await import("node:child_process")
  try {
    execSync(`tar -xzf "${tarPath}" -C "${destDir}"`, { stdio: "pipe" })
  } catch {
    console.error(
      `Failed to extract ${tarPath}.\n` +
      `Make sure 'tar' is available on your system.\n` +
      `Or extract manually: tar -xzf "${tarPath}" -C "${destDir}"`,
    )
    process.exitCode = 1
    return
  }
  console.log()
  console.log(`WASM renderer installed to ${destDir}`)
  console.log(`  ${WASM_JS_FILE}`)
  console.log(`  ${WASM_BG_FILE}`)
}

// =========================================================================
// tsx resolution
// =========================================================================

function findTsx(): string | null {
  // Check local node_modules first
  const local = resolve("node_modules", ".bin", "tsx")
  if (existsSync(local)) return local
  // Check PATH
  const result = spawnSync("which", ["tsx"], { stdio: "pipe" })
  if (result.status === 0) return result.stdout.toString().trim()
  return null
}

// =========================================================================
// Main
// =========================================================================

async function main(argv: string[]): Promise<void> {
  const args = argv.slice(2)
  const command = args[0]

  if (command === "--help" || command === "-h" || command === undefined) {
    console.log(USAGE)
    return
  }

  if (command === "--version" || command === "-v") {
    console.log(readVersion())
    return
  }

  switch (command) {
    case "download":
      await handleDownload(args.slice(1))
      break
    case "dev":
      if (args[1] === undefined) {
        console.error("Error: missing <app> argument\n")
        console.log(USAGE)
        process.exitCode = 1
        return
      }
      console.error(
        "The dev server requires tsx to run TypeScript files directly.\n" +
        "Install it: pnpm add -D tsx\n" +
        "Then run: npx tsx --watch " + args[1],
      )
      break
    case "run":
      if (args[1] === undefined) {
        console.error("Error: missing <app> argument\n")
        console.log(USAGE)
        process.exitCode = 1
        return
      }
      console.error(
        "Running TypeScript apps directly requires tsx.\n" +
        "Install it: pnpm add -D tsx\n" +
        "Then run: npx tsx " + args[1],
      )
      break
    default:
      console.error(`Unknown command: ${command}\n`)
      console.log(USAGE)
      process.exitCode = 1
  }
}

void main(process.argv)

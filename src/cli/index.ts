#!/usr/bin/env node

/**
 * CLI entry point for the plushie SDK.
 *
 * Commands:
 *   plushie download       -- download the precompiled binary
 *   plushie download --wasm -- download the WASM renderer
 *   plushie dev <app>      -- run an app with file watching
 *   plushie run <app>      -- run an app
 *   plushie stdio <app>    -- run in stdio transport mode (for plushie --exec)
 *   plushie inspect <app>  -- print the initial view tree as JSON
 *   plushie --help         -- print usage
 *   plushie --version      -- print version
 *
 * @module
 */

import { createRequire } from "node:module"
import { existsSync, mkdirSync, createWriteStream, chmodSync, readFileSync, writeFileSync, unlinkSync } from "node:fs"
import { resolve, join, dirname } from "node:path"
import { get as httpsGet } from "node:https"
import { spawnSync, spawn } from "node:child_process"
import {
  platformBinaryName,
  downloadBinary as downloadBinaryAPI,
  BINARY_VERSION, RELEASE_BASE_URL as BASE_URL,
} from "../client/binary.js"
import { DEFAULT_WASM_DIR, WASM_JS_FILE, WASM_BG_FILE } from "../wasm.js"

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
  stdio <app>       Run an app in stdio transport mode (for plushie --exec)
  inspect <app>     Print the initial view tree as formatted JSON

Options:
  --help            Show this help message
  --version         Show version number
  --json            Use JSON wire format (default: msgpack)
  --binary <path>   Override binary path
  --no-watch        Disable file watching in dev mode`

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
    await handleDownloadBinary(force)
  }
}

async function handleDownloadBinary(force: boolean): Promise<void> {
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

  // Use the programmatic API for the actual download
  const resultPath = await downloadBinaryAPI({ destDir, force: true })

  // Verify checksum on top of the API download
  const checksumUrl = `${url}.sha256`
  try {
    const checksumPath = `${resultPath}.sha256`
    await downloadFile(checksumUrl, checksumPath)

    const { createHash } = await import("node:crypto")
    const fileData = readFileSync(resultPath)
    const actualHash = createHash("sha256").update(fileData).digest("hex")
    const expectedHash = readFileSync(checksumPath, "utf-8").trim().split(/\s+/)[0] ?? ""

    if (actualHash !== expectedHash) {
      console.error(`  WARNING: SHA256 mismatch for ${binaryName}`)
      console.error(`    expected: ${expectedHash}`)
      console.error(`    actual:   ${actualHash}`)
    } else {
      console.log(`  SHA256 verified: ${actualHash.slice(0, 16)}...`)
    }
  } catch {
    console.log("  (checksum verification skipped)")
  }

  console.log()
  console.log(`Binary installed to ${resultPath}`)
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

  // Parse flags from the remaining args (after the command)
  const rest = args.slice(1)
  const flags = rest.filter(a => a.startsWith("--"))
  const positional = rest.filter(a => !a.startsWith("--"))
  const jsonFlag = flags.includes("--json")
  const noWatch = flags.includes("--no-watch")
  const binaryIdx = rest.indexOf("--binary")
  const binaryOverride = binaryIdx !== -1 ? rest[binaryIdx + 1] : undefined

  // Build extra env vars from flags
  const extraEnv: Record<string, string> = {}
  if (jsonFlag) extraEnv["PLUSHIE_FORMAT"] = "json"
  if (binaryOverride !== undefined) extraEnv["PLUSHIE_BINARY_PATH"] = binaryOverride

  switch (command) {
    case "download":
      await handleDownload(rest)
      break
    case "dev": {
      if (positional[0] === undefined) {
        console.error("Error: missing <app> argument\n")
        console.log(USAGE)
        process.exitCode = 1
        return
      }
      const devTsx = findTsx()
      if (!devTsx) {
        console.error("tsx is required for dev mode.\nInstall: pnpm add -D tsx")
        process.exitCode = 1
        return
      }
      const devArgs = noWatch ? [positional[0]] : ["--watch", positional[0]]
      const devChild = spawn(devTsx, devArgs, {
        stdio: "inherit",
        env: { ...process.env, ...extraEnv },
      })
      devChild.on("exit", (code) => { process.exitCode = code ?? 1 })
      break
    }
    case "run": {
      if (positional[0] === undefined) {
        console.error("Error: missing <app> argument\n")
        console.log(USAGE)
        process.exitCode = 1
        return
      }
      const runTsx = findTsx()
      if (!runTsx) {
        console.error("tsx is required to run TypeScript apps directly.\nInstall: pnpm add -D tsx")
        process.exitCode = 1
        return
      }
      const runChild = spawn(runTsx, [positional[0]], {
        stdio: "inherit",
        env: { ...process.env, ...extraEnv },
      })
      runChild.on("exit", (code) => { process.exitCode = code ?? 1 })
      break
    }
    case "stdio": {
      if (positional[0] === undefined) {
        console.error("Error: missing <app> argument\n")
        console.log(USAGE)
        process.exitCode = 1
        return
      }
      const stdioTsx = findTsx()
      if (!stdioTsx) {
        console.error("tsx is required.\nInstall: pnpm add -D tsx")
        process.exitCode = 1
        return
      }
      const stdioChild = spawn(stdioTsx, [positional[0]], {
        stdio: "inherit",
        env: { ...process.env, ...extraEnv, PLUSHIE_TRANSPORT: "stdio" },
      })
      stdioChild.on("exit", (code) => { process.exitCode = code ?? 1 })
      break
    }
    case "inspect": {
      if (positional[0] === undefined) {
        console.error("Error: missing <app> argument\n")
        console.log(USAGE)
        process.exitCode = 1
        return
      }
      const inspectTsx = findTsx()
      if (!inspectTsx) {
        console.error("tsx is required.\nInstall: pnpm add -D tsx")
        process.exitCode = 1
        return
      }
      const appPath = resolve(positional[0])
      const normalizePath = resolve(dirname(new URL(import.meta.url).pathname), "..", "tree", "normalize.ts")
      const inspectScript = [
        `import app from '${appPath}';`,
        `import { normalize } from '${normalizePath}';`,
        `const config = app.config;`,
        `const init = Array.isArray(config.init) ? config.init[0] : config.init;`,
        `const tree = config.view(init);`,
        `const wire = normalize(tree);`,
        `console.log(JSON.stringify(wire, null, 2));`,
      ].join("\n")
      const tmpScript = resolve(".plushie-inspect.mts")
      writeFileSync(tmpScript, inspectScript, "utf-8")
      const inspectChild = spawn(inspectTsx, [tmpScript], { stdio: "inherit" })
      inspectChild.on("exit", (code) => {
        try { unlinkSync(tmpScript) } catch { /* ignore */ }
        process.exitCode = code ?? 1
      })
      break
    }
    default:
      console.error(`Unknown command: ${command}\n`)
      console.log(USAGE)
      process.exitCode = 1
  }
}

void main(process.argv)

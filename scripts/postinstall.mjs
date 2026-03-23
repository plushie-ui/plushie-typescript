#!/usr/bin/env node

/**
 * Postinstall script: downloads the plushie binary for the current platform.
 *
 * Skipped when:
 *   - PLUSHIE_SKIP_DOWNLOAD=1 is set
 *   - PLUSHIE_BINARY_PATH is set (user has their own binary)
 *   - Running in CI without explicit opt-in (CI=true and PLUSHIE_DOWNLOAD_IN_CI is not set)
 *
 * Failures are non-fatal -- the script logs a message and exits 0 so that
 * npm install never fails because of a download issue. Users can always
 * run `npx plushie download` manually.
 */

import { existsSync, mkdirSync, chmodSync, createWriteStream } from "node:fs"
import { get as httpsGet } from "node:https"
import { dirname, join, resolve } from "node:path"

const BINARY_VERSION = "0.4.1"
const RELEASE_BASE_URL = "https://github.com/plushie-ui/plushie/releases/download"

// Skip conditions
if (process.env.PLUSHIE_SKIP_DOWNLOAD === "1") {
  process.exit(0)
}

if (process.env.PLUSHIE_BINARY_PATH) {
  process.exit(0)
}

if (process.env.CI && !process.env.PLUSHIE_DOWNLOAD_IN_CI) {
  console.log("plushie: skipping binary download in CI (set PLUSHIE_DOWNLOAD_IN_CI=1 to enable)")
  process.exit(0)
}

function platformOs() {
  switch (process.platform) {
    case "darwin": return "darwin"
    case "linux": return "linux"
    case "win32": return "windows"
    default: return process.platform
  }
}

function platformArch() {
  switch (process.arch) {
    case "x64": return "x86_64"
    case "arm64": return "aarch64"
    default: return process.arch
  }
}

const ext = platformOs() === "windows" ? ".exe" : ""
const binaryName = `plushie-${platformOs()}-${platformArch()}${ext}`
const destDir = resolve("node_modules", ".plushie", "bin")
const destPath = join(destDir, binaryName)

// Already downloaded
if (existsSync(destPath)) {
  process.exit(0)
}

const url = `${RELEASE_BASE_URL}/v${BINARY_VERSION}/${binaryName}`

console.log(`plushie: downloading binary (v${BINARY_VERSION}) for ${platformOs()}-${platformArch()}...`)

function download(currentUrl, depth = 0) {
  if (depth > 5) {
    console.warn("plushie: too many redirects, skipping download")
    console.warn("plushie: run 'npx plushie download' to download manually")
    process.exit(0)
  }

  httpsGet(currentUrl, { headers: { "User-Agent": "plushie-ts-sdk" } }, (response) => {
    if ((response.statusCode === 301 || response.statusCode === 302) && response.headers.location) {
      download(response.headers.location, depth + 1)
      return
    }

    if (response.statusCode !== 200) {
      console.warn(`plushie: download failed (HTTP ${response.statusCode})`)
      console.warn("plushie: run 'npx plushie download' to download manually")
      process.exit(0)
    }

    mkdirSync(destDir, { recursive: true })
    const file = createWriteStream(destPath)
    response.pipe(file)
    file.on("finish", () => {
      file.close()
      if (process.platform !== "win32") {
        chmodSync(destPath, 0o755)
      }
      console.log("plushie: binary downloaded successfully")
    })
    file.on("error", () => {
      console.warn("plushie: download failed (write error)")
      console.warn("plushie: run 'npx plushie download' to download manually")
      process.exit(0)
    })
  }).on("error", () => {
    console.warn("plushie: download failed (network error)")
    console.warn("plushie: run 'npx plushie download' to download manually")
    process.exit(0)
  })
}

download(url)

#!/usr/bin/env node

/**
 * Postinstall script: downloads the plushie binary for the current platform.
 *
 * Skipped when:
 *   - PLUSHIE_SKIP_DOWNLOAD=1 is set
 *   - PLUSHIE_BINARY_PATH is set (user has their own binary)
 *   - Running in CI without explicit opt-in (CI=true and PLUSHIE_DOWNLOAD_IN_CI is not set)
 *
 * Failures are non-fatal; the script logs a message and exits 0 so that
 * npm install never fails because of a download issue. Users can always
 * run `npx plushie download` manually.
 */

import { createHash, randomUUID } from "node:crypto"
import {
  chmodSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
} from "node:fs"
import { get as httpsGet } from "node:https"
import { basename, dirname, join, resolve } from "node:path"

const PLUSHIE_RUST_VERSION = "0.7.1"
const RELEASE_BASE_URL = "https://github.com/plushie-ui/plushie-renderer/releases/download"
const DOWNLOAD_ATTEMPTS = 3
const DOWNLOAD_RETRY_DELAY_MS = 100
const DOWNLOAD_TIMEOUT_MS = 30000
const MAX_REDIRECTS = 5

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
    case "darwin":
      return "darwin"
    case "linux":
      return "linux"
    case "win32":
      return "windows"
    default:
      return process.platform
  }
}

function platformArch() {
  switch (process.arch) {
    case "x64":
      return "x86_64"
    case "arm64":
      return "aarch64"
    default:
      return process.arch
  }
}

let configBinFile
try {
  const configPath = resolve("plushie.extensions.json")
  if (existsSync(configPath)) {
    const raw = JSON.parse(readFileSync(configPath, "utf-8"))
    configBinFile = raw.bin_file
  }
} catch {}

const ext = platformOs() === "windows" ? ".exe" : ""
const binaryName = `plushie-renderer-${platformOs()}-${platformArch()}${ext}`
const destDir = configBinFile ? resolve(configBinFile, "..") : resolve("node_modules", ".plushie", "bin")
const destPath = configBinFile ? resolve(configBinFile) : join(destDir, binaryName)

if (existsSync(destPath)) {
  process.exit(0)
}

const url = `${RELEASE_BASE_URL}/v${PLUSHIE_RUST_VERSION}/${binaryName}`

async function main() {
  console.log(`plushie: downloading binary (v${PLUSHIE_RUST_VERSION}) for ${platformOs()}-${platformArch()}...`)

  try {
    await installVerifiedFile(url, destPath)
    console.log("plushie: binary downloaded successfully")
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn(`plushie: binary download skipped (${message})`)
    console.warn("plushie: run `npx plushie download` to download manually")
  }
}

async function installVerifiedFile(url, destPath) {
  const fileTempPath = await downloadToTemp(url, destPath)
  let checksumTempPath
  try {
    checksumTempPath = await downloadToTemp(`${url}.sha256`, `${destPath}.sha256`)
    const expectedHash = parseChecksum(readFileSync(checksumTempPath, "utf-8"), `${url}.sha256`)
    const actualHash = createHash("sha256").update(readFileSync(fileTempPath)).digest("hex")

    if (actualHash !== expectedHash) {
      throw new Error(`SHA256 mismatch for ${basename(destPath)}`)
    }

    if (process.platform !== "win32") {
      chmodSync(fileTempPath, 0o755)
    }
    renameSync(fileTempPath, destPath)
  } catch (err) {
    rmSync(fileTempPath, { force: true })
    throw err
  } finally {
    if (checksumTempPath !== undefined) {
      rmSync(checksumTempPath, { force: true })
    }
  }
}

async function downloadToTemp(url, destPath) {
  const dir = dirname(destPath)
  mkdirSync(dir, { recursive: true })
  let lastError

  for (let attempt = 1; attempt <= DOWNLOAD_ATTEMPTS; attempt += 1) {
    const tempPath = join(dir, `.${basename(destPath)}.${process.pid}.${randomUUID()}.tmp`)
    try {
      await downloadOnce(url, tempPath, 0)
      return tempPath
    } catch (err) {
      rmSync(tempPath, { force: true })
      lastError = err
      if (!isRetryable(err) || attempt === DOWNLOAD_ATTEMPTS) {
        throw err
      }
      await sleep(DOWNLOAD_RETRY_DELAY_MS * attempt)
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

function downloadOnce(currentUrl, tempPath, depth) {
  if (depth > MAX_REDIRECTS) {
    return Promise.reject(new DownloadFailure("too many redirects", false))
  }

  return new Promise((resolve, reject) => {
    let parsed
    try {
      parsed = new URL(currentUrl)
    } catch {
      reject(new DownloadFailure(`invalid download URL: ${currentUrl}`, false))
      return
    }

    if (parsed.protocol !== "https:") {
      reject(new DownloadFailure(`refusing non-HTTPS download URL: ${currentUrl}`, false))
      return
    }

    const request = httpsGet(
      currentUrl,
      { headers: { "User-Agent": "plushie-ts-sdk" } },
      (response) => {
        const statusCode = response.statusCode ?? 0

        if (isRedirect(statusCode) && response.headers.location) {
          response.resume()
          const location = Array.isArray(response.headers.location)
            ? response.headers.location[0]
            : response.headers.location
          const nextUrl = new URL(location, currentUrl).toString()
          downloadOnce(nextUrl, tempPath, depth + 1).then(resolve, reject)
          return
        }

        if (statusCode !== 200) {
          response.resume()
          reject(new DownloadFailure(`HTTP ${statusCode}`, isRetryableStatus(statusCode)))
          return
        }

        const file = createWriteStream(tempPath, { flags: "wx" })
        let settled = false

        const fail = (err) => {
          if (settled) return
          settled = true
          file.destroy()
          reject(toDownloadFailure(err))
        }

        response.on("aborted", () => {
          fail(new DownloadFailure("download aborted", true))
        })
        response.on("error", fail)
        file.on("error", fail)
        file.on("finish", () => {
          file.close((err) => {
            if (err) {
              fail(err)
              return
            }
            if (settled) return
            settled = true
            resolve()
          })
        })
        response.pipe(file)
      },
    )

    request.setTimeout(DOWNLOAD_TIMEOUT_MS, () => {
      request.destroy(new DownloadFailure(`timed out downloading ${currentUrl}`, true))
    })
    request.on("error", (err) => {
      reject(toDownloadFailure(err))
    })
  })
}

function parseChecksum(contents, url) {
  const checksum = contents.trim().split(/\s+/)[0] ?? ""
  if (!/^[0-9a-fA-F]{64}$/.test(checksum)) {
    throw new Error(`invalid SHA256 checksum from ${url}`)
  }
  return checksum.toLowerCase()
}

function isRedirect(statusCode) {
  return [301, 302, 303, 307, 308].includes(statusCode)
}

function isRetryableStatus(statusCode) {
  return statusCode === 429 || statusCode >= 500
}

function isRetryable(err) {
  return err instanceof DownloadFailure ? err.retryable : true
}

function toDownloadFailure(err) {
  if (err instanceof DownloadFailure) return err
  const message = err instanceof Error ? err.message : String(err)
  return new DownloadFailure(message, true)
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

class DownloadFailure extends Error {
  constructor(message, retryable) {
    super(message)
    this.name = "DownloadFailure"
    this.retryable = retryable
  }
}

await main()

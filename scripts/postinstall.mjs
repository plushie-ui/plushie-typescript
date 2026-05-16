#!/usr/bin/env node

/**
 * Postinstall script: bootstraps the managed Plushie native tool set.
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
import { spawnSync } from "node:child_process"
import {
  chmodSync,
  copyFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { get as httpGet } from "node:http"
import { get as httpsGet } from "node:https"
import { basename, dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const PLUSHIE_RUST_VERSION = "0.7.1"
const RELEASE_BASE_URL = "https://github.com/plushie-ui/plushie-rust/releases/download"
const RELEASE_BASE_URL_ENV = "PLUSHIE_RELEASE_BASE_URL"
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
const projectRoot = process.env.INIT_CWD ? resolve(process.env.INIT_CWD) : process.cwd()
try {
  const configPath = resolve(projectRoot, "plushie.extensions.json")
  if (existsSync(configPath)) {
    const raw = JSON.parse(readFileSync(configPath, "utf-8"))
    configBinFile = raw.bin_file
  }
} catch {}

const ext = platformOs() === "windows" ? ".exe" : ""
const toolAssetName = `plushie-${platformOs()}-${platformArch()}${ext}`
const toolName = `plushie${ext}`
const installedName = `plushie-renderer${ext}`
const launcherName = `plushie-launcher${ext}`
const destDir = configBinFile
  ? resolve(projectRoot, configBinFile, "..")
  : resolve(projectRoot, "bin")
const destPath = configBinFile ? resolve(projectRoot, configBinFile) : join(destDir, installedName)
const managedBinDir = resolve(projectRoot, "bin")
const toolPath = join(managedBinDir, toolName)
const managedRendererPath = join(managedBinDir, installedName)
const managedLauncherPath = join(managedBinDir, launcherName)

async function main() {
  console.log(`plushie: syncing native tools (v${PLUSHIE_RUST_VERSION}) for ${platformOs()}-${platformArch()}...`)

  try {
    const url = `${releaseBaseUrl()}/v${PLUSHIE_RUST_VERSION}/${toolAssetName}`
    if (!toolsCheck()) {
      if (!existsSync(toolPath)) {
        await installVerifiedFile(url, toolPath)
      }
      if (!toolsSync() && existsSync(toolPath)) {
        await installVerifiedFile(url, toolPath)
        requireToolsSync()
      }
      requireToolsCheck()
    }
    copyConfiguredRenderer()
    console.log("plushie: native tools synced successfully")
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn(`plushie: native tool sync skipped (${message})`)
    console.warn("plushie: run `npx plushie download` to download manually")
  }
}

function isLocalHttpHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
}

function validateDownloadProtocol(parsed, previousProtocol) {
  if (parsed.protocol === "http:" && previousProtocol === "https:") {
    return `Refusing HTTPS to HTTP redirect for ${parsed.toString()}`
  }
  if (parsed.protocol === "http:" && !isLocalHttpHost(parsed.hostname)) {
    return `Refusing non-local HTTP download URL: ${parsed.toString()}`
  }
  return undefined
}

function releaseBaseUrl() {
  const value = (process.env[RELEASE_BASE_URL_ENV] ?? RELEASE_BASE_URL).trim().replace(/\/+$/, "")
  if (value === "") {
    throw new Error(`${RELEASE_BASE_URL_ENV} must not be empty`)
  }
  let parsed
  try {
    parsed = new URL(value)
  } catch {
    throw new Error(`${RELEASE_BASE_URL_ENV} is not a valid URL: ${value}`)
  }
  const protocolError = validateDownloadProtocol(parsed, undefined)
  if (protocolError !== undefined) {
    throw new Error(protocolError)
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:" && parsed.protocol !== "file:") {
    throw new Error(`${RELEASE_BASE_URL_ENV} must use https://, file://, or loopback http://`)
  }
  return value
}

function toolsCheck() {
  if (!existsSync(toolPath)) return false
  const result = spawnSync(
    toolPath,
    ["tools", "check", "--required-version", PLUSHIE_RUST_VERSION],
    { cwd: projectRoot, stdio: "ignore" },
  )
  return result.status === 0
}

function requireToolsCheck() {
  if (!existsSync(toolPath)) {
    throw new Error(`missing ${toolPath}`)
  }
  const result = spawnSync(
    toolPath,
    ["tools", "check", "--required-version", PLUSHIE_RUST_VERSION],
    { cwd: projectRoot, stdio: "inherit" },
  )
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`bin/plushie tools check failed with status ${result.status ?? "unknown"}`)
  }
}

function toolsSync() {
  const result = spawnSync(
    toolPath,
    ["tools", "sync", "--required-version", PLUSHIE_RUST_VERSION],
    { cwd: projectRoot, stdio: "inherit" },
  )
  if (result.error) throw result.error
  return result.status === 0
}

function requireToolsSync() {
  if (!toolsSync()) {
    throw new Error("bin/plushie tools sync failed")
  }
}

function copyConfiguredRenderer() {
  for (const path of [toolPath, managedRendererPath, managedLauncherPath]) {
    if (!existsSync(path)) {
      throw new Error(`managed native tool missing after sync: ${path}`)
    }
  }
  if (resolve(destPath) === resolve(managedRendererPath)) return
  mkdirSync(dirname(destPath), { recursive: true })
  copyFileSync(managedRendererPath, destPath)
  if (process.platform !== "win32") {
    chmodSync(destPath, 0o755)
  }
}

async function installVerifiedFile(url, destPath) {
  let fileTempPath = await downloadToTemp(url, destPath)
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
    // Clear so the catch block does not attempt to remove a path that no longer exists.
    fileTempPath = undefined
  } catch (err) {
    if (fileTempPath !== undefined) {
      rmSync(fileTempPath, { force: true })
    }
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

function downloadOnce(currentUrl, tempPath, depth, previousProtocol) {
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

    const protocolError = validateDownloadProtocol(parsed, previousProtocol)
    if (protocolError !== undefined) {
      reject(new DownloadFailure(protocolError, false))
      return
    }

    if (parsed.protocol === "file:") {
      try {
        writeFileSync(tempPath, readFileSync(fileURLToPath(parsed)), { flag: "wx" })
        resolve()
      } catch (err) {
        reject(toDownloadFailure(err))
      }
      return
    }

    const get = parsed.protocol === "http:" ? httpGet : httpsGet

    const request = get(
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
          downloadOnce(nextUrl, tempPath, depth + 1, parsed.protocol).then(resolve, reject)
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

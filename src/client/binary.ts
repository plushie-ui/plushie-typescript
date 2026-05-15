/**
 * Plushie binary path resolution and download.
 *
 * The plushie binary is a hard requirement; without it, nothing
 * works. This module resolves the binary path using a priority-based
 * lookup, and provides a download function for fetching precompiled
 * binaries.
 *
 * ## Resolution order
 *
 * 1. `PLUSHIE_BINARY_PATH` env var (must exist, error if file missing)
 * 2. SEA-bundled binary (if running in Node.js Single Executable context)
 * 3. Downloaded binary at `bin/plushie-renderer`
 * 4. Common local paths: `./plushie-renderer`, `../plushie-rust/target/release/plushie-renderer`
 * 5. Error with guidance to download
 *
 * @module
 */

import { createHash, randomUUID } from "node:crypto";
import {
  chmodSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
} from "node:fs";
import type { IncomingMessage } from "node:http";
import { get as httpGet } from "node:http";
import { get as httpsGet } from "node:https";
import { basename, dirname, join, resolve } from "node:path";
import { arch, platform } from "node:process";
import { extractBinaryFromSEA, isSEA } from "../sea.js";

/** plushie-rust release version matching this SDK release. */
export const PLUSHIE_RUST_VERSION = "0.7.1";

/** GitHub release base URL. */
export const RELEASE_BASE_URL = "https://github.com/plushie-ui/plushie-renderer/releases/download";

const DOWNLOAD_ATTEMPTS = 3;
const DOWNLOAD_RETRY_DELAY_MS = 100;
const DOWNLOAD_TIMEOUT_MS = 30_000;
const MAX_REDIRECTS = 5;

interface DownloadOptions {
  attempts?: number;
  retryDelayMs?: number;
}

interface DownloadReleaseBinaryOptions extends DownloadOptions {
  destPath: string;
  binaryName?: string;
  releaseBaseUrl?: string;
  version?: string;
  force?: boolean;
}

class DownloadFailure extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "DownloadFailure";
  }
}

/**
 * Map Node.js platform/arch to plushie binary naming convention.
 *
 * @returns Platform-specific release asset name (e.g., "plushie-renderer-linux-x86_64").
 */
export function releaseBinaryName(): string {
  const os = platformOs();
  const cpu = platformArch();
  const ext = os === "windows" ? ".exe" : "";
  return `plushie-renderer-${os}-${cpu}${ext}`;
}

/** Return the stable project-local renderer filename. */
export function installedBinaryName(): string {
  const ext = platformOs() === "windows" ? ".exe" : "";
  return `plushie-renderer${ext}`;
}

export const platformBinaryName = releaseBinaryName;

function platformOs(): string {
  switch (platform) {
    case "darwin":
      return "darwin";
    case "linux":
      return "linux";
    case "win32":
      return "windows";
    default:
      return platform;
  }
}

function platformArch(): string {
  switch (arch) {
    case "x64":
      return "x86_64";
    case "arm64":
      return "aarch64";
    default:
      return arch;
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
  const envPath = process.env["PLUSHIE_BINARY_PATH"];
  if (envPath) {
    const resolved = resolve(envPath);
    if (!existsSync(resolved)) {
      throw new Error(
        `PLUSHIE_BINARY_PATH is set to "${envPath}" but the file does not exist.\n` +
          `Check the path or unset PLUSHIE_BINARY_PATH to use automatic resolution.`,
      );
    }
    return resolved;
  }

  // 2. SEA-bundled binary (if running in a Node.js Single Executable)
  if (isSEA()) {
    try {
      return extractBinaryFromSEA();
    } catch {
      // Asset not bundled; fall through to filesystem checks
    }
  }

  // 3. Downloaded or cargo-plushie-installed binary in project-root bin/.
  //    `npx plushie build` copies its output here, so stock downloads
  //    and custom renderers share the same resolution step.
  const downloadDir = resolve("bin");
  const downloadPath = join(downloadDir, installedBinaryName());
  if (existsSync(downloadPath)) {
    validateArchitecture(downloadPath);
    return downloadPath;
  }

  // 4. Common local paths (for development against local builds)
  const localPaths = [
    resolve("plushie-renderer"),
    resolve("..", "plushie-rust", "target", "release", "plushie-renderer"),
    resolve("..", "plushie-rust", "target", "debug", "plushie-renderer"),
  ];
  for (const p of localPaths) {
    if (existsSync(p)) {
      validateArchitecture(p);
      return p;
    }
  }

  // 5. Not found
  throw new Error(
    `Could not find the plushie binary.\n\n` +
      `To fix this, either:\n` +
      `  - Set PLUSHIE_BINARY_PATH to point to a local build\n` +
      `  - Run: npx plushie download\n\n` +
      `Expected binary name: ${installedBinaryName()}\n` +
      `Checked: ${downloadPath}`,
  );
}

/**
 * Validate that the binary matches the current system architecture.
 * Best-effort: silently succeeds if the `file` command is unavailable.
 *
 * @throws {Error} If the binary architecture doesn't match the system.
 */
export function validateArchitecture(binaryPath: string): void {
  try {
    const { execSync } = require("node:child_process") as typeof import("node:child_process");
    const output = execSync(`file "${binaryPath}"`, { encoding: "utf-8" });

    const is64 = output.includes("x86-64") || output.includes("x86_64") || output.includes("amd64");
    const isArm =
      output.includes("aarch64") || output.includes("arm64") || output.includes("ARM aarch64");

    const systemArch = process.arch; // "x64" or "arm64"

    if (systemArch === "x64" && isArm && !is64) {
      throw new Error(
        `Architecture mismatch: binary is ARM64 but system is x86_64.\n` +
          `Download the correct binary: ${releaseBinaryName()}`,
      );
    }
    if (systemArch === "arm64" && is64 && !isArm) {
      throw new Error(
        `Architecture mismatch: binary is x86_64 but system is ARM64.\n` +
          `Download the correct binary: ${releaseBinaryName()}`,
      );
    }
  } catch (err) {
    // If it's our own Error, re-throw
    if (err instanceof Error && err.message.includes("Architecture mismatch")) throw err;
    // Otherwise silently succeed (file command not available)
  }
}

/**
 * Download the precompiled plushie binary for the current platform.
 *
 * @param opts.destDir - Destination directory. Defaults to bin/
 * @param opts.force - Re-download even if binary already exists.
 * @returns Path to the downloaded binary.
 */
export async function downloadBinary(opts?: {
  destDir?: string;
  force?: boolean;
}): Promise<string> {
  const name = releaseBinaryName();
  const destDir = opts?.destDir ?? resolve("bin");
  const destPath = join(destDir, installedBinaryName());
  return downloadReleaseBinary({
    binaryName: name,
    destPath,
    force: opts?.force ?? false,
  });
}

export async function downloadReleaseBinary(opts: DownloadReleaseBinaryOptions): Promise<string> {
  const binaryName = opts.binaryName ?? platformBinaryName();
  const version = opts.version ?? PLUSHIE_RUST_VERSION;
  const releaseBaseUrl = trimTrailingSlash(opts.releaseBaseUrl ?? RELEASE_BASE_URL);
  const destPath = resolve(opts.destPath);
  const url = `${releaseBaseUrl}/v${version}/${binaryName}`;

  if (!opts.force && existsSync(destPath)) return destPath;

  await downloadFileWithChecksum(url, destPath, opts);

  if (process.platform !== "win32") chmodSync(destPath, 0o755);

  return destPath;
}

export async function downloadFileWithChecksum(
  url: string,
  destPath: string,
  opts: DownloadOptions = {},
): Promise<string> {
  const fileTempPath = await downloadToTemp(url, destPath, opts);
  let checksumTempPath: string | undefined;

  try {
    checksumTempPath = await downloadToTemp(`${url}.sha256`, `${destPath}.sha256`, opts);
    const expectedHash = parseChecksum(readFileSync(checksumTempPath, "utf-8"), `${url}.sha256`);
    const actualHash = createHash("sha256").update(readFileSync(fileTempPath)).digest("hex");

    if (actualHash !== expectedHash) {
      throw new Error(
        `SHA256 mismatch for ${basename(destPath)}: expected ${expectedHash}, got ${actualHash}`,
      );
    }

    moveIntoPlace(fileTempPath, destPath);
    return destPath;
  } catch (err) {
    rmSync(fileTempPath, { force: true });
    throw err;
  } finally {
    if (checksumTempPath !== undefined) {
      rmSync(checksumTempPath, { force: true });
    }
  }
}

async function downloadToTemp(
  url: string,
  destPath: string,
  opts: DownloadOptions,
): Promise<string> {
  const attempts = opts.attempts ?? DOWNLOAD_ATTEMPTS;
  const retryDelayMs = opts.retryDelayMs ?? DOWNLOAD_RETRY_DELAY_MS;
  const dir = dirname(destPath);
  mkdirSync(dir, { recursive: true });

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const tempPath = join(dir, `.${basename(destPath)}.${process.pid}.${randomUUID()}.tmp`);
    try {
      await downloadOnce(url, tempPath);
      return tempPath;
    } catch (err) {
      rmSync(tempPath, { force: true });
      lastError = err;
      if (!isRetryable(err) || attempt === attempts) {
        throw err;
      }
      await sleep(retryDelayMs * attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function downloadOnce(url: string, tempPath: string): Promise<void> {
  return downloadOnceFollow(url, tempPath, 0, undefined);
}

function downloadOnceFollow(
  currentUrl: string,
  tempPath: string,
  depth: number,
  previousProtocol: string | undefined,
): Promise<void> {
  if (depth > MAX_REDIRECTS) {
    return Promise.reject(new DownloadFailure("Too many redirects", false));
  }

  return new Promise((resolve, reject) => {
    let parsed: URL;
    try {
      parsed = new URL(currentUrl);
    } catch {
      reject(new DownloadFailure(`Invalid download URL: ${currentUrl}`, false));
      return;
    }

    const protocolError = validateDownloadProtocol(parsed, previousProtocol);
    if (protocolError !== undefined) {
      reject(new DownloadFailure(protocolError, false));
      return;
    }

    const get =
      parsed.protocol === "http:" ? httpGet : parsed.protocol === "https:" ? httpsGet : undefined;
    if (get === undefined) {
      reject(new DownloadFailure(`Unsupported download URL protocol: ${parsed.protocol}`, false));
      return;
    }

    const request = get(
      currentUrl,
      { headers: { "User-Agent": "plushie-ts-sdk" } },
      (response: IncomingMessage) => {
        const statusCode = response.statusCode ?? 0;

        if (isRedirect(statusCode) && response.headers["location"]) {
          response.resume();
          const nextUrl = new URL(response.headers["location"], currentUrl).toString();
          downloadOnceFollow(nextUrl, tempPath, depth + 1, parsed.protocol).then(resolve, reject);
          return;
        }

        if (statusCode !== 200) {
          response.resume();
          reject(
            new DownloadFailure(
              `HTTP ${String(statusCode)} downloading ${currentUrl}`,
              isRetryableStatus(statusCode),
            ),
          );
          return;
        }

        const file = createWriteStream(tempPath, { flags: "wx" });
        let settled = false;

        const fail = (err: unknown) => {
          if (settled) return;
          settled = true;
          file.destroy();
          reject(toDownloadFailure(err));
        };

        response.on("aborted", () => {
          fail(new DownloadFailure(`Download aborted for ${currentUrl}`, true));
        });
        response.on("error", fail);
        file.on("error", fail);
        file.on("finish", () => {
          file.close((err) => {
            if (err) {
              fail(err);
              return;
            }
            if (settled) return;
            settled = true;
            resolve();
          });
        });
        response.pipe(file);
      },
    );

    request.setTimeout(DOWNLOAD_TIMEOUT_MS, () => {
      request.destroy(new DownloadFailure(`Timed out downloading ${currentUrl}`, true));
    });
    request.on("error", (err) => {
      reject(toDownloadFailure(err));
    });
  });
}

function moveIntoPlace(tempPath: string, destPath: string): void {
  renameSync(tempPath, destPath);
}

function parseChecksum(contents: string, url: string): string {
  const checksum = contents.trim().split(/\s+/)[0] ?? "";
  if (!/^[0-9a-fA-F]{64}$/.test(checksum)) {
    throw new Error(`Invalid SHA256 checksum from ${url}`);
  }
  return checksum.toLowerCase();
}

function isRedirect(statusCode: number): boolean {
  return [301, 302, 303, 307, 308].includes(statusCode);
}

function isRetryableStatus(statusCode: number): boolean {
  return statusCode === 429 || statusCode >= 500;
}

function validateDownloadProtocol(
  parsed: URL,
  previousProtocol: string | undefined,
): string | undefined {
  if (parsed.protocol === "http:" && previousProtocol === "https:") {
    return `Refusing HTTPS to HTTP redirect for ${parsed.toString()}`;
  }
  if (parsed.protocol === "http:" && !isLocalHttpHost(parsed.hostname)) {
    return `Refusing non-local HTTP download URL: ${parsed.toString()}`;
  }
  return undefined;
}

function isLocalHttpHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function isRetryable(err: unknown): boolean {
  return err instanceof DownloadFailure ? err.retryable : true;
}

function toDownloadFailure(err: unknown): DownloadFailure {
  if (err instanceof DownloadFailure) return err;
  const message = err instanceof Error ? err.message : String(err);
  return new DownloadFailure(message, true);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

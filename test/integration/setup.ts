/**
 * Integration test setup.
 *
 * Checks whether the plushie binary is available. Integration tests
 * that need the binary import `binaryAvailable` and `binaryPath`
 * from this module and use `skipIfNoBinary` to conditionally skip.
 */

import { existsSync } from "node:fs";

/** Resolved binary path, or null if not available. */
export const binaryPath: string | null = (() => {
  // 1. Environment variable
  const envPath = process.env["PLUSHIE_BINARY_PATH"];
  if (envPath && existsSync(envPath)) return envPath;

  // 2. Downloaded binary
  const { resolve } = require("node:path") as typeof import("node:path");
  const { platform, arch } = require("node:process") as typeof import("node:process");

  const os = platform === "darwin" ? "darwin" : platform === "win32" ? "windows" : "linux";
  const cpu = arch === "x64" ? "x86_64" : arch === "arm64" ? "aarch64" : arch;
  const ext = os === "windows" ? ".exe" : "";
  const name = `plushie-renderer-${os}-${cpu}${ext}`;

  const downloadPath = resolve("node_modules", ".plushie", "bin", name);
  if (existsSync(downloadPath)) return downloadPath;

  // 3. Local build paths
  const localPaths = [
    resolve("..", "plushie-rust", "target", "release", "plushie-renderer"),
    resolve("..", "plushie-rust", "target", "debug", "plushie-renderer"),
  ];
  for (const p of localPaths) {
    if (existsSync(p)) return p;
  }

  return null;
})();

/** Whether the plushie binary is available for integration tests. */
export const binaryAvailable = binaryPath !== null;

/** Helper for use with `test.skipIf(!binaryAvailable)`. */
export const skipIfNoBinary = !binaryAvailable;

/**
 * Node.js Single Executable Application (SEA) support.
 *
 * When a plushie app is bundled as a standalone executable via
 * Node.js SEA, the plushie binary can be included as an asset.
 * This module handles extracting and using bundled assets.
 *
 * @module
 */

import { chmodSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

type Chmod = (path: string, mode: number) => void;

/**
 * Check if we're running inside a Node.js SEA bundle.
 *
 * The `node:sea` module is only available in SEA context. If it
 * can be required, we're running as a bundled executable.
 */
export function isSEA(): boolean {
  try {
    require("node:sea");
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract the plushie binary from SEA assets to a temp file.
 *
 * The binary must have been included as an asset in the SEA
 * configuration under the given key. The extracted file is
 * written to `os.tmpdir()` and made executable on platforms that use
 * executable permission bits.
 *
 * @param assetKey - The key used in the SEA config's assets map. Defaults to `"plushie-binary"`.
 * @returns Absolute path to the extracted binary.
 * @throws {Error} If not running in SEA context or asset is missing.
 */
export function extractBinaryFromSEA(assetKey = "plushie-binary"): string {
  let sea: { getAsset(key: string): ArrayBuffer };
  try {
    sea = require("node:sea") as typeof sea;
  } catch {
    throw new Error("extractBinaryFromSEA called outside of SEA context");
  }

  let asset: ArrayBuffer;
  try {
    asset = sea.getAsset(assetKey);
  } catch {
    throw new Error(
      `SEA asset "${assetKey}" not found.\n` +
        `Include the plushie binary in your SEA config:\n\n` +
        `  "assets": { "${assetKey}": "path/to/plushie" }`,
    );
  }

  const dest = extractedSEABinaryPath();
  writeFileSync(dest, Buffer.from(asset));
  makeExtractedBinaryExecutable(dest);
  return dest;
}

export function extractedSEABinaryPath(
  opts: { platform?: NodeJS.Platform; pid?: number; tempDir?: string } = {},
): string {
  const platform = opts.platform ?? process.platform;
  const pid = opts.pid ?? process.pid;
  const dir = opts.tempDir ?? tmpdir();
  const ext = platform === "win32" ? ".exe" : "";
  return join(dir, `plushie-sea-${pid}${ext}`);
}

export function makeExtractedBinaryExecutable(
  path: string,
  platform: NodeJS.Platform = process.platform,
  chmod: Chmod = chmodSync,
): void {
  if (platform === "win32") return;
  chmod(path, 0o755);
}

/** SEA configuration file structure. */
export interface SEAConfig {
  main: string;
  output: string;
  assets?: Record<string, string>;
  disableExperimentalSEAWarning?: boolean;
  useSnapshot?: boolean;
  useCodeCache?: boolean;
}

/**
 * Generate a SEA configuration object for bundling a plushie app.
 *
 * The generated config includes the plushie binary (and optionally
 * WASM files) as SEA assets, so the bundled executable is fully
 * self-contained.
 *
 * @param opts - Configuration options.
 * @returns A SEA config object suitable for writing to sea-config.json.
 */
export function generateSEAConfig(opts: {
  main: string;
  output: string;
  binaryPath?: string;
  wasmDir?: string;
}): SEAConfig {
  const assets: Record<string, string> = {};

  if (opts.binaryPath) {
    assets["plushie-binary"] = opts.binaryPath;
  }

  if (opts.wasmDir) {
    assets["plushie-wasm-js"] = join(opts.wasmDir, "plushie_renderer_wasm.js");
    assets["plushie-wasm-bg"] = join(opts.wasmDir, "plushie_renderer_wasm_bg.wasm");
  }

  const config: SEAConfig = {
    main: opts.main,
    output: opts.output,
    disableExperimentalSEAWarning: true,
    useSnapshot: false,
    useCodeCache: true,
  };

  if (Object.keys(assets).length > 0) {
    config.assets = assets;
  }

  return config;
}

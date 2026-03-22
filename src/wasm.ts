/**
 * WASM renderer support.
 *
 * The plushie renderer can also run as a WebAssembly module for
 * browser and embedded use cases. This module handles WASM binary
 * resolution and loading.
 *
 * @module
 */

import { existsSync } from "node:fs"
import { join, resolve } from "node:path"

/** Default WASM directory. */
export const DEFAULT_WASM_DIR = "node_modules/.plushie/wasm"

/** WASM JS loader file name produced by wasm-pack. */
export const WASM_JS_FILE = "plushie_wasm.js"

/** WASM binary file name produced by wasm-pack. */
export const WASM_BG_FILE = "plushie_wasm_bg.wasm"

/** Resolved WASM file paths. */
export interface WasmPaths {
  jsPath: string
  wasmPath: string
}

/**
 * Resolve the WASM renderer files.
 *
 * Resolution order:
 * 1. `PLUSHIE_WASM_PATH` env var (directory containing WASM files)
 * 2. Explicit `wasmDir` argument
 * 3. Downloaded files at `node_modules/.plushie/wasm/`
 * 4. Error with guidance
 *
 * @param wasmDir - Optional directory containing WASM files.
 * @returns Paths to the JS loader and WASM binary.
 * @throws {Error} If no WASM files are found.
 */
export function resolveWasm(wasmDir?: string): WasmPaths {
  const candidates: string[] = []

  // 1. Environment variable override
  const envDir = process.env["PLUSHIE_WASM_PATH"]
  if (envDir) {
    candidates.push(resolve(envDir))
  }

  // 2. Explicit argument
  if (wasmDir) {
    candidates.push(resolve(wasmDir))
  }

  // 3. Default download location
  candidates.push(resolve(DEFAULT_WASM_DIR))

  for (const dir of candidates) {
    const jsPath = join(dir, WASM_JS_FILE)
    const wasmPath = join(dir, WASM_BG_FILE)
    if (existsSync(jsPath) && existsSync(wasmPath)) {
      return { jsPath, wasmPath }
    }
  }

  throw new Error(
    `Could not find the plushie WASM renderer.\n\n` +
    `To fix this, either:\n` +
    `  - Set PLUSHIE_WASM_PATH to the directory containing WASM files\n` +
    `  - Run: npx plushie download --wasm\n\n` +
    `Expected files: ${WASM_JS_FILE}, ${WASM_BG_FILE}\n` +
    `Checked: ${candidates.join(", ")}`,
  )
}

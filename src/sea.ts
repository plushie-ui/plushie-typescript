/**
 * Node.js Single Executable Application (SEA) support.
 *
 * Helpers for building host-only SEA bundles for the shared Rust
 * launcher payload shape.
 *
 * @module
 */

import { join } from "node:path";

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
 * The generated config produces a host-only SEA executable for use
 * with the shared Rust launcher payload shape.
 *
 * @param opts - Configuration options.
 * @returns A SEA config object suitable for writing to sea-config.json.
 */
export function generateSEAConfig(opts: {
  main: string;
  output: string;
  wasmDir?: string;
}): SEAConfig {
  const assets: Record<string, string> = {};

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

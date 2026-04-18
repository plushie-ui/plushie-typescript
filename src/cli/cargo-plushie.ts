/**
 * Resolve how to invoke `cargo plushie`.
 *
 * `cargo plushie` is a Cargo subcommand implemented by the
 * `cargo-plushie` crate in plushie-rust. The TypeScript CLI delegates
 * renderer workspace generation to it. Two resolution paths are
 * supported:
 *
 * 1. `PLUSHIE_RUST_SOURCE_PATH` points at a plushie-rust checkout,
 *    in which case we run the build tool out of that checkout via
 *    `cargo run -p cargo-plushie --release --quiet --`. This is the
 *    dev-and-verification path.
 * 2. `cargo-plushie` is installed on PATH at a matching version, in
 *    which case we invoke the binary directly.
 *
 * When neither resolves, callers get a clear error listing both
 * options.
 *
 * @module
 */

import { execSync } from "node:child_process";
import { PLUSHIE_RUST_VERSION } from "../client/binary.js";

/**
 * Resolved invocation recipe for `cargo plushie`.
 *
 * Callers spawn `command` with `[...argsPrefix, ...userArgs]`.
 */
export interface CargoPlushieInvocation {
  /** Command to run (`cargo` or `cargo-plushie`). */
  readonly command: string;
  /** Args prepended before user-supplied args. */
  readonly argsPrefix: readonly string[];
  /** Tag for callers that want to log which path was taken. */
  readonly source: "source-path" | "installed";
}

/** Result of a `cargo-plushie --version` probe on PATH. */
interface VersionProbe {
  readonly found: boolean;
  readonly version?: string;
}

/** Options (primarily to make the function testable). */
export interface ResolveCargoPlushieOptions {
  /** Override for `process.env` lookup. */
  readonly env?: NodeJS.ProcessEnv;
  /**
   * Probe for the installed binary's `--version`. Defaults to
   * running `cargo-plushie --version` synchronously and parsing
   * the output. Override in tests to avoid touching the real PATH.
   */
  readonly probeInstalled?: () => VersionProbe;
  /**
   * Expected version string. Defaults to `PLUSHIE_RUST_VERSION`.
   * Primarily for testing the mismatch branch.
   */
  readonly expectedVersion?: string;
}

/**
 * Resolve how to invoke `cargo plushie` for this project.
 *
 * Resolution order:
 *
 * 1. `PLUSHIE_RUST_SOURCE_PATH` set in the environment.
 * 2. `cargo-plushie` installed and on PATH at a matching version.
 *
 * @throws {Error} If neither resolution path succeeds. The error
 * lists the install command and the env var alternative.
 */
export function resolveCargoPlushie(opts: ResolveCargoPlushieOptions = {}): CargoPlushieInvocation {
  const env = opts.env ?? process.env;
  const expected = opts.expectedVersion ?? PLUSHIE_RUST_VERSION;

  // 1. Source-path checkout. We let the env var win even if a
  //    matching binary happens to be installed: running out of the
  //    checkout is the contract when the dev has one.
  const sourcePath = env["PLUSHIE_RUST_SOURCE_PATH"];
  if (sourcePath !== undefined && sourcePath !== "") {
    return {
      command: "cargo",
      argsPrefix: [
        "run",
        "--manifest-path",
        `${sourcePath}/Cargo.toml`,
        "-p",
        "cargo-plushie",
        "--release",
        "--quiet",
        "--",
      ],
      source: "source-path",
    };
  }

  // 2. Installed on PATH at a matching version.
  const probe = opts.probeInstalled ?? defaultProbeInstalled;
  const result = probe();
  if (result.found && result.version === expected) {
    return {
      command: "cargo-plushie",
      argsPrefix: [],
      source: "installed",
    };
  }

  // 3. Neither path resolved. Build an actionable error.
  const installedDetail = result.found
    ? `found cargo-plushie ${result.version ?? "(unknown version)"}, expected ${expected}`
    : "cargo-plushie not found on PATH";
  throw new Error(
    `Unable to locate cargo-plushie (${installedDetail}).\n\n` +
      `To fix this, either:\n` +
      `  - Install the matching build tool:\n` +
      `      cargo install cargo-plushie --version ${expected}\n` +
      `  - Point at a plushie-rust checkout:\n` +
      `      PLUSHIE_RUST_SOURCE_PATH=/path/to/plushie-rust npx plushie build`,
  );
}

/**
 * Run `cargo-plushie --version` and parse its output.
 *
 * `cargo-plushie --version` prints `cargo-plushie <semver>` on
 * success. Any spawn/parse failure is treated as "not found" so the
 * caller can fall through to a clear error.
 */
function defaultProbeInstalled(): VersionProbe {
  try {
    const output = execSync("cargo-plushie --version", {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const match = output.match(/cargo-plushie\s+(\S+)/);
    if (match?.[1]) {
      return { found: true, version: match[1] };
    }
    return { found: true };
  } catch {
    return { found: false };
  }
}

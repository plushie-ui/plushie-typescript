#!/usr/bin/env node

/**
 * Rebuild the plushie-renderer binary from a local plushie-rust
 * checkout, then drop it into project-root bin/ where
 * resolveBinary picks it up. Run as the first preflight step so
 * tests exercise the current renderer rather than a stale cached
 * artifact.
 *
 * Behaviour:
 *   - PLUSHIE_RUST_SOURCE_PATH unset: no-op (falls back to whatever
 *     postinstall already put in bin/).
 *   - PLUSHIE_RUST_SOURCE_PATH set: runs `cargo build --release -p
 *     plushie-renderer` with cwd at the workspace, so its
 *     `[patch.crates-io]` overrides for plushie-iced apply, then
 *     copies the resulting binary into bin/ under the stable name
 *     resolveBinary expects.
 *
 * Exits non-zero if the cargo build fails or the binary is missing
 * after a reportedly-successful build.
 */

import { spawnSync } from "node:child_process"
import { copyFileSync, existsSync, mkdirSync } from "node:fs"
import { dirname, join, resolve } from "node:path"

const sourcePath = process.env.PLUSHIE_RUST_SOURCE_PATH
if (!sourcePath || sourcePath.trim() === "") {
  process.exit(0)
}

const workspace = resolve(sourcePath)
const manifest = join(workspace, "Cargo.toml")
if (!existsSync(manifest)) {
  console.error(
    `plushie: PLUSHIE_RUST_SOURCE_PATH=${sourcePath} but no Cargo.toml at ${manifest}`,
  )
  process.exit(1)
}

const binaryName = process.platform === "win32" ? "plushie-renderer.exe" : "plushie-renderer"
const builtBinary = join(workspace, "target", "release", binaryName)

console.log(`plushie: rebuilding ${binaryName} from ${workspace}`)

const cargo = spawnSync("cargo", ["build", "--release", "-p", "plushie-renderer"], {
  cwd: workspace,
  stdio: "inherit",
})

if (cargo.status !== 0) {
  process.exit(cargo.status === null ? 1 : cargo.status)
}

if (!existsSync(builtBinary)) {
  console.error(`plushie: cargo build succeeded but ${builtBinary} is missing`)
  process.exit(1)
}

const destName = process.platform === "win32" ? "plushie-renderer.exe" : "plushie-renderer"
const destDir = resolve("bin")
const destPath = join(destDir, destName)

mkdirSync(dirname(destPath), { recursive: true })
copyFileSync(builtBinary, destPath)

console.log(`plushie: installed fresh renderer at ${destPath}`)

#!/usr/bin/env node

/**
 * CLI entry point for the plushie SDK.
 *
 * Commands:
 *   plushie download        :  download the precompiled binary
 *   plushie download --wasm :  download the WASM renderer
 *   plushie build           :  build plushie from Rust source
 *   plushie build --wasm    :  build WASM renderer via wasm-pack
 *   plushie dev <app>       :  run an app with file watching
 *   plushie run <app>       :  run an app
 *   plushie stdio <app>     :  run in renderer-parent stdio mode
 *   plushie inspect <app>   :  print the initial view tree as JSON
 *   plushie connect <addr>  :  connect to a plushie --listen instance
 *   plushie script          :  run .plushie test scripts
 *   plushie replay <file>   :  replay a .plushie script with real windows
 *   plushie package         :  prepare a shared-launcher package payload
 *   plushie --help          :  print usage
 *   plushie --version       :  print version
 *
 * @module
 */

import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, join, relative, resolve } from "node:path";
import {
  downloadFileWithChecksum,
  downloadTool,
  installedBinaryName,
  installedLauncherName,
  installedToolName,
  PLUSHIE_RUST_VERSION,
  releaseBaseUrl,
} from "../client/binary.js";
import { DevServer } from "../dev-server.js";
import {
  defaultPackageStartConfig,
  prepareNodePackagePayload,
  type RendererKind,
  writePackageStartConfig,
} from "../package.js";
import { DEFAULT_WASM_DIR, WASM_BG_FILE, WASM_JS_FILE } from "../wasm.js";
import { resolveCargoPlushie } from "./cargo-plushie.js";

function readVersion(): string {
  const require = createRequire(import.meta.url);
  const pkg = require("../../package.json") as { version: string };
  return pkg.version;
}

// Project config

/** Project-level plushie config from plushie.extensions.json. */
interface ProjectConfig {
  artifacts?: string[];
  bin_file?: string;
  wasm_dir?: string;
  source_path?: string;
  extensions?: unknown[];
  binaryName?: string;
}

/**
 * Read project config from plushie.extensions.json.
 * Returns empty config if the file doesn't exist.
 */
function readProjectConfig(): ProjectConfig {
  const configPath = resolve("plushie.extensions.json");
  if (!existsSync(configPath)) return {};
  try {
    return JSON.parse(readFileSync(configPath, "utf-8")) as ProjectConfig;
  } catch {
    return {};
  }
}

const USAGE = `\
Usage: plushie <command> [options]

Commands:
  download          Download the precompiled plushie binary
  download --wasm   Download the WASM renderer
  build             Build plushie from Rust source (release profile)
  build --wasm      Build WASM renderer via wasm-pack
  dev <app>         Run an app with file watching (hot reload)
  run <app>         Run an app
  stdio <app>       Run an app in renderer-parent stdio mode
  inspect <app>     Print the initial view tree as formatted JSON
  connect <addr>    Connect to a plushie --listen instance
  script [files]    Run .plushie test scripts
  replay <file>     Replay a .plushie script with real windows
  package           Prepare a standalone package payload

Options:
  --help            Show this help message
  --version         Show version number
  --json            Use JSON wire format (default: msgpack)
  --binary <path>   Override binary path
  --bin-file <path> Override binary destination (download/build)
  --wasm-dir <dir>  Override WASM output directory (download --wasm / build --wasm)
  --token <value>   Shared token for socket connect, sent as settings.token_sha256
  --app-id <id>     Package app identifier (package)
  --app-name <name> Package display name (package)
  --app-version <v> Package app version (package)
  --main <path>     Bundled CommonJS host entry for SEA packaging (package)
  --host-bin <path> Prepared host executable to copy into the payload (package)
  --host-name <name> Payload-local host executable name (package)
  --output <dir>    Package output directory (package)
  --renderer-kind <kind> Renderer kind: stock or custom (package)
  --renderer-path <p> Use an existing renderer binary (package)
  --package-config <p> Source package config path (package)
  --write-package-config Write a package config template and exit (package)
  --icon <path>     App icon copied into the package payload (package)
  --strict-tools    Require strict native package tool identity (package)
  --target <target> Override package target (package)
  --bin             Download/build the native binary
  --wasm            Download/build the WASM renderer
  --no-watch        Disable file watching in dev mode

Config (plushie.extensions.json):
  artifacts         ["bin"], ["wasm"], or ["bin", "wasm"] (default: ["bin"])
  bin_file          Binary destination path
  wasm_dir          WASM output directory
  source_path       Rust source directory (for build)`;

// =========================================================================
// Download
// =========================================================================

/**
 * Download a file and verify its SHA256 checksum.
 */
async function downloadWithChecksum(url: string, destPath: string, label: string): Promise<void> {
  process.stdout.write(`  Downloading ${label}...`);
  try {
    await downloadFileWithChecksum(url, destPath);
    console.log(" done");
  } catch (err) {
    console.log(" failed");
    throw err;
  }
}

async function handleDownload(
  flags: string[],
  binFile?: string,
  wasmDir?: string,
  config?: ProjectConfig,
): Promise<void> {
  const force = flags.includes("--force");
  const explicitBin = flags.includes("--bin");
  const explicitWasm = flags.includes("--wasm");

  // Resolve what to download: CLI flags > config artifacts > default ["bin"]
  const artifacts =
    explicitBin || explicitWasm
      ? [...(explicitBin ? ["bin"] : []), ...(explicitWasm ? ["wasm"] : [])]
      : (config?.artifacts ?? ["bin"]);

  // Resolve paths: CLI flag > config > default
  const resolvedBinFile = binFile ?? config?.bin_file;
  const resolvedWasmDir = wasmDir ?? config?.wasm_dir;

  if (artifacts.includes("bin")) {
    // Block precompiled download when native extensions are configured.
    // The stock binary doesn't include native extensions; users must
    // build a custom binary with `npx plushie build` instead.
    const extConfigPath = resolve("plushie.extensions.json");
    if (existsSync(extConfigPath)) {
      try {
        const raw = JSON.parse(readFileSync(extConfigPath, "utf-8")) as {
          extensions?: Array<{ rustCrate?: string }>;
        };
        const nativeExts = (raw.extensions ?? []).filter((e) => e.rustCrate);
        if (nativeExts.length > 0) {
          console.error(
            `Cannot download precompiled binary: plushie.extensions.json declares ` +
              `native widget(s) that require a custom build.\n` +
              `Run \`npx plushie build\` instead.`,
          );
          process.exitCode = 1;
          return;
        }
      } catch {
        // Config exists but can't be parsed; let it through, build will catch it
      }
    }
    const sourcePath = process.env["PLUSHIE_RUST_SOURCE_PATH"] ?? config?.source_path;
    await handleDownloadBinary(force, resolvedBinFile, sourcePath);
  }
  if (artifacts.includes("wasm")) {
    await downloadWasm(force, resolvedWasmDir);
  }
}

async function handleDownloadBinary(
  force: boolean,
  binFile?: string,
  sourcePath?: string,
): Promise<void> {
  const rendererPath =
    sourcePath !== undefined && sourcePath.trim() !== ""
      ? syncManagedToolsFromSource(sourcePath, force)
      : await syncManagedToolsFromRelease(force);

  if (binFile !== undefined) {
    const destPath = resolve(binFile);
    if (!force && existsSync(destPath)) {
      console.log(`Binary already exists at ${destPath}`);
      console.log("Use --force to re-download.");
      return;
    }
    mkdirSync(dirname(destPath), { recursive: true });
    copyFileSync(rendererPath, destPath);
    if (process.platform !== "win32") {
      chmodSync(destPath, 0o755);
    }
    console.log();
    console.log(`Binary installed to ${destPath}`);
  }
}

function syncManagedToolsFromSource(sourcePath: string, force: boolean): string {
  const manifestPath = resolve(sourcePath, "Cargo.toml");
  if (!existsSync(manifestPath)) {
    throw new Error(`PLUSHIE_RUST_SOURCE_PATH does not contain Cargo.toml: ${sourcePath}`);
  }
  const args = [
    "run",
    "--manifest-path",
    manifestPath,
    "-p",
    "cargo-plushie",
    "--bin",
    "plushie",
    "--release",
    "--quiet",
    "--",
    "tools",
    "sync",
    "--required-version",
    PLUSHIE_RUST_VERSION,
  ];
  if (force) args.push("--force");
  const result = spawnSync("cargo", args, { stdio: "inherit" });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`bin/plushie tools sync failed with status ${result.status ?? "unknown"}`);
  }
  return verifyManagedNativeTools();
}

async function syncManagedToolsFromRelease(force: boolean): Promise<string> {
  console.log(`Downloading plushie tool v${PLUSHIE_RUST_VERSION}`);
  const toolPath = await downloadTool({ force });
  console.log(`Tool installed to ${toolPath}`);
  const args = ["tools", "sync", "--required-version", PLUSHIE_RUST_VERSION];
  if (force) args.push("--force");
  const result = spawnSync(toolPath, args, { stdio: "inherit" });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`bin/plushie tools sync failed with status ${result.status ?? "unknown"}`);
  }
  return verifyManagedNativeTools(toolPath);
}

function verifyManagedNativeTools(toolPath = resolve("bin", installedToolName())): string {
  const rendererPath = resolve("bin", installedBinaryName());
  const launcherPath = resolve("bin", installedLauncherName());
  for (const path of [toolPath, rendererPath, launcherPath]) {
    if (!existsSync(path)) {
      throw new Error(`managed Plushie tool sync did not install ${path}`);
    }
  }

  const result = spawnSync(
    toolPath,
    ["tools", "check", "--required-version", PLUSHIE_RUST_VERSION],
    { stdio: "inherit" },
  );
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`bin/plushie tools check failed with status ${result.status ?? "unknown"}`);
  }
  return rendererPath;
}

async function downloadWasm(force: boolean, wasmDir?: string): Promise<void> {
  const destDir = wasmDir ? resolve(wasmDir) : resolve(DEFAULT_WASM_DIR);
  const tarUrl = `${releaseBaseUrl()}/v${PLUSHIE_RUST_VERSION}/plushie-renderer-wasm.tar.gz`;
  const tarPath = join(destDir, "plushie-renderer-wasm.tar.gz");

  if (
    !force &&
    existsSync(join(destDir, WASM_JS_FILE)) &&
    existsSync(join(destDir, WASM_BG_FILE))
  ) {
    console.log(`WASM files already exist in ${destDir}`);
    console.log("Use --force to re-download.");
    return;
  }

  console.log(`Downloading plushie WASM renderer v${PLUSHIE_RUST_VERSION}`);
  console.log(`  From: ${tarUrl}`);
  console.log();

  await downloadWithChecksum(tarUrl, tarPath, "plushie-renderer-wasm.tar.gz");

  // Extract tar.gz
  console.log("  Extracting...");
  const { execSync } = await import("node:child_process");
  try {
    execSync(`tar -xzf "${tarPath}" -C "${destDir}"`, { stdio: "pipe" });
  } catch {
    console.error(
      `Failed to extract ${tarPath}.\n` +
        `Make sure 'tar' is available on your system.\n` +
        `Or extract manually: tar -xzf "${tarPath}" -C "${destDir}"`,
    );
    process.exitCode = 1;
    return;
  }
  console.log();
  console.log(`WASM renderer installed to ${destDir}`);
  console.log(`  ${WASM_JS_FILE}`);
  console.log(`  ${WASM_BG_FILE}`);
}

// =========================================================================
// Build
// =========================================================================

function waitForChild(child: ChildProcess): Promise<number> {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => {
      resolve(code ?? 1);
    });
  });
}

function recordBuildExitCode(code: number): void {
  if (code !== 0 || process.exitCode === undefined) {
    process.exitCode = code;
  }
}

async function handleBuild(
  flags: string[],
  binDestFile?: string,
  wasmDestDir?: string,
  config?: ProjectConfig,
): Promise<void> {
  // Resolve source path: env var > config > undefined (uses crates.io for extensions)
  const sourcePath = process.env["PLUSHIE_RUST_SOURCE_PATH"] ?? config?.source_path;

  const explicitBin = flags.includes("--bin");
  const explicitWasm = flags.includes("--wasm");
  const isRelease = true;

  // Resolve what to build: CLI flags > config artifacts > default ["bin"]
  const artifacts =
    explicitBin || explicitWasm
      ? [...(explicitBin ? ["bin"] : []), ...(explicitWasm ? ["wasm"] : [])]
      : (config?.artifacts ?? ["bin"]);

  const wantBin = artifacts.includes("bin");
  const wantWasm = artifacts.includes("wasm");

  // Resolve WASM dest: CLI flag > config > default
  const resolvedWasmDir = wasmDestDir ?? config?.wasm_dir;
  const resolvedBinFile = binDestFile ?? config?.bin_file;

  if (wantWasm) {
    if (!sourcePath) {
      console.error(
        "Rust source path required for WASM builds.\n" +
          "Set PLUSHIE_RUST_SOURCE_PATH or add source_path to plushie.extensions.json.",
      );
      process.exitCode = 1;
      return;
    }
    const wpCheck = spawnSync("which", ["wasm-pack"], { stdio: "pipe" });
    if (wpCheck.status !== 0) {
      console.error(
        "wasm-pack is required for WASM builds.\n" +
          "Install: https://rustwasm.github.io/wasm-pack/installer/",
      );
      process.exitCode = 1;
      return;
    }
    const wasmDir = resolve(sourcePath, "crates", "plushie-renderer-wasm");
    const buildArgs = ["build", "--target", "web"];
    if (isRelease) {
      buildArgs.push("--release");
    } else {
      buildArgs.push("--dev");
    }
    console.log(`Building WASM renderer in ${wasmDir}...`);
    const child = spawn("wasm-pack", buildArgs, { cwd: wasmDir, stdio: "inherit" });
    const code = await waitForChild(child);
    recordBuildExitCode(code);
    if (code === 0) {
      // Install WASM output to the project's wasm directory
      const pkgDir = resolve(wasmDir, "pkg");
      const destDir = resolvedWasmDir ? resolve(resolvedWasmDir) : resolve(DEFAULT_WASM_DIR);
      mkdirSync(destDir, { recursive: true });
      for (const name of [WASM_JS_FILE, WASM_BG_FILE]) {
        const src = join(pkgDir, name);
        if (existsSync(src)) {
          copyFileSync(src, join(destDir, name));
        } else {
          console.error(`  Warning: expected ${src} not found in wasm-pack output`);
        }
      }
      console.log(`\nWASM files installed to ${destDir}`);
    }
  }

  if (wantBin) {
    const extConfigPath = resolve("plushie.extensions.json");
    if (
      existsSync(extConfigPath) &&
      (await handleNativeWidgetBuild(extConfigPath, isRelease, sourcePath, resolvedBinFile))
    ) {
      return;
    }

    // Check Rust toolchain version
    const minRust = [1, 92, 0] as const;
    const rustcResult = spawnSync("rustc", ["--version"], { stdio: "pipe" });
    if (rustcResult.status !== 0) {
      console.error(
        "cargo/rustc (Rust) is required for source builds.\nInstall: https://rustup.rs",
      );
      process.exitCode = 1;
      return;
    }
    const rustcOutput = rustcResult.stdout.toString();
    const versionMatch = rustcOutput.match(/rustc (\d+)\.(\d+)\.(\d+)/);
    if (versionMatch) {
      const [, major, minor, patch] = versionMatch;
      const version = [Number(major), Number(minor), Number(patch)] as const;
      if (
        version[0] < minRust[0] ||
        (version[0] === minRust[0] && version[1] < minRust[1]) ||
        (version[0] === minRust[0] && version[1] === minRust[1] && version[2] < minRust[2])
      ) {
        console.error(
          `Rust ${String(version[0])}.${String(version[1])}.${String(version[2])} found, but ` +
            `${String(minRust[0])}.${String(minRust[1])}.${String(minRust[2])}+ is required.\n` +
            `Update with: rustup update`,
        );
        process.exitCode = 1;
        return;
      }
    }

    if (!sourcePath) {
      console.error(
        "Rust source path required for stock binary builds.\n" +
          "Set PLUSHIE_RUST_SOURCE_PATH or add source_path to plushie.extensions.json.",
      );
      process.exitCode = 1;
      return;
    }
    const buildArgs = ["build", "-p", "plushie-renderer"];
    if (isRelease) buildArgs.push("--release");
    console.log(`Building plushie binary in ${sourcePath}...`);
    const child = spawn("cargo", buildArgs, { cwd: sourcePath, stdio: "inherit" });
    const code = await waitForChild(child);
    recordBuildExitCode(code);
    if (code === 0) {
      const profile = isRelease ? "release" : "debug";
      const ext = process.platform === "win32" ? ".exe" : "";
      const binPath = resolve(sourcePath, "target", profile, "plushie-renderer" + ext);
      const installedPath = installRendererBinary(binPath, resolvedBinFile);
      console.log(`\nBinary installed at: ${installedPath}`);
    }
  }
}

/** Returns true if the native widget build was initiated, false if no native widgets found. */
async function handleNativeWidgetBuild(
  configPath: string,
  release: boolean,
  sourcePath: string | undefined,
  binDestFile: string | undefined,
): Promise<boolean> {
  let parsed: {
    extensions?: Array<import("../native-widget.js").NativeWidgetConfig>;
    binaryName?: string;
  };
  try {
    parsed = JSON.parse(readFileSync(configPath, "utf-8")) as typeof parsed;
  } catch (err) {
    console.error(`Failed to read ${configPath}: ${String(err)}`);
    process.exitCode = 1;
    return true;
  }

  // A native widget crate is any extension that declares a rustCrate
  // path. Pure TS extensions have no rustCrate and don't need a
  // custom renderer build.
  const nativeExts = (parsed.extensions ?? []).filter((e) => e.rustCrate);
  if (nativeExts.length === 0) {
    return false;
  }

  console.log(`Building custom renderer with ${String(nativeExts.length)} native widget(s):`);
  for (const ext of nativeExts) {
    console.log(`  ${ext.type} (${ext.rustCrate})`);
  }

  // Write a virtual app crate that lists each native widget as a
  // path dependency. cargo plushie build walks the dep graph via
  // cargo metadata, finds each widget's
  // [package.metadata.plushie.widget] table, and generates the
  // renderer workspace that registers them.
  const scratchDir = resolve("node_modules", ".plushie", "renderer-spec");
  const scratchCargoToml = join(scratchDir, "Cargo.toml");
  mkdirSync(join(scratchDir, "src"), { recursive: true });

  const binaryName = parsed.binaryName;
  writeFileSync(scratchCargoToml, renderSpecCargoToml(nativeExts, binaryName), "utf-8");
  writeFileSync(join(scratchDir, "src", "lib.rs"), "// generated by plushie CLI\n", "utf-8");

  // Merge config source_path into the env before resolving so both
  // resolveCargoPlushie and the spawned child see the same value.
  const childEnv: NodeJS.ProcessEnv = { ...process.env };
  if (sourcePath !== undefined && childEnv["PLUSHIE_RUST_SOURCE_PATH"] === undefined) {
    childEnv["PLUSHIE_RUST_SOURCE_PATH"] = resolve(sourcePath);
  }

  // Resolve how to invoke cargo plushie (source-path checkout or
  // installed binary at a matching PLUSHIE_RUST_VERSION).
  let invocation: ReturnType<typeof resolveCargoPlushie>;
  try {
    invocation = resolveCargoPlushie({ env: childEnv });
  } catch (err) {
    console.error(String(err instanceof Error ? err.message : err));
    process.exitCode = 1;
    return true;
  }

  const userArgs = ["build", "--manifest-path", scratchCargoToml];
  if (release) userArgs.push("--release");

  const cargoPlushieArgs = [...invocation.argsPrefix, ...userArgs];
  console.log(`\nRunning cargo plushie build (${invocation.source})...`);

  const child = spawn(invocation.command, cargoPlushieArgs, { stdio: "inherit", env: childEnv });
  const code = await waitForChild(child);
  recordBuildExitCode(code);
  if (code !== 0) {
    return true;
  }
  try {
    const installedPath = installBuiltBinary(scratchDir, binaryName, release, binDestFile);
    console.log(`\nCustom renderer installed at ${installedPath}`);
  } catch (err) {
    console.error(String(err instanceof Error ? err.message : err));
    process.exitCode = 1;
  }
  return true;
}

/**
 * Render the scratch app crate's `Cargo.toml`.
 *
 * The crate exists solely to anchor a `cargo metadata` walk from
 * `cargo plushie build`: it lists every native widget as a path
 * dependency so the build tool can find their
 * `[package.metadata.plushie.widget]` tables. The `[package.metadata.plushie]`
 * block forwards the optional `binary_name` override; cargo-plushie
 * derives it as `<app>-renderer` otherwise.
 */
function renderSpecCargoToml(
  widgets: readonly import("../native-widget.js").NativeWidgetConfig[],
  binaryName: string | undefined,
): string {
  const scratchDir = resolve("node_modules", ".plushie", "renderer-spec");
  const depLines = widgets
    .map((w) => {
      const absolute = resolve(w.rustCrate!);
      const rel = relativePath(scratchDir, absolute);
      const crateName = basenameOf(w.rustCrate!);
      return `${crateName} = { path = ${JSON.stringify(rel)} }`;
    })
    .join("\n");

  const metadataBlock =
    binaryName !== undefined
      ? `\n[package.metadata.plushie]\nbinary_name = ${JSON.stringify(binaryName)}\n`
      : "";

  return [
    "[package]",
    `name = "plushie-renderer-spec"`,
    `version = "0.0.0"`,
    `edition = "2024"`,
    `publish = false`,
    "",
    "[lib]",
    `path = "src/lib.rs"`,
    "",
    "[dependencies]",
    depLines,
    metadataBlock,
  ].join("\n");
}

/** Basename of a path string (crate directory name). */
function basenameOf(p: string): string {
  const parts = resolve(p).split(/[\\/]/);
  return parts[parts.length - 1] ?? p;
}

/**
 * Produce a relative path from `from` to `to` using forward slashes,
 * which Cargo understands on every platform.
 */
function relativePath(from: string, to: string): string {
  return relative(from, to).split("\\").join("/");
}

/**
 * Copy the freshly-built renderer binary from the cargo-plushie
 * workspace into project-root `bin/` using the stable renderer name the SDK's
 * binary resolver expects.
 *
 * cargo-plushie writes to `{scratch}/target/plushie-renderer/target/{profile}/{bin}`.
 */
function installBuiltBinary(
  scratchDir: string,
  binaryName: string | undefined,
  release: boolean,
  binDestFile: string | undefined,
): string {
  const profile = release ? "release" : "debug";
  // cargo-plushie defaults binary_name to `<app>-renderer`. Our
  // scratch app is named `plushie-renderer-spec` so the default is
  // `plushie-renderer-spec-renderer`. Keep the override when set.
  const resolvedBin = binaryName ?? "plushie-renderer-spec-renderer";
  const ext = process.platform === "win32" ? ".exe" : "";
  const src = join(scratchDir, "target", "plushie-renderer", "target", profile, resolvedBin + ext);
  if (!existsSync(src)) {
    throw new Error(`cargo plushie build succeeded but the expected binary is missing:\n  ${src}`);
  }
  return installRendererBinary(src, binDestFile);
}

function installRendererBinary(src: string, binDestFile: string | undefined): string {
  if (!existsSync(src)) {
    throw new Error(`renderer build succeeded but the expected binary is missing:\n  ${src}`);
  }
  const dest =
    binDestFile === undefined ? resolve("bin", installedBinaryName()) : resolve(binDestFile);
  const destDir = dirname(dest);
  mkdirSync(destDir, { recursive: true });
  copyFileSync(src, dest);
  if (process.platform !== "win32") {
    chmodSync(dest, 0o755);
  }
  return dest;
}

// =========================================================================
// Connect
// =========================================================================

async function handleConnect(
  positional: string[],
  flags: string[],
  binaryOverride: string | undefined,
  tokenOverride: string | undefined,
): Promise<void> {
  const addr = positional[0];
  const appFile = positional[1];
  if (!addr) {
    console.error("Usage: plushie connect <address> [app]\n");
    console.error("Address: /path, :port, host:port, or [IPv6]:port");
    console.log(USAGE);
    process.exitCode = 1;
    return;
  }

  const jsonFlag = flags.includes("--json");
  const format = jsonFlag ? ("json" as const) : ("msgpack" as const);
  const token = tokenOverride ?? process.env["PLUSHIE_TOKEN"];

  if (appFile) {
    // App file provided: spawn it with tsx and socket env vars
    const tsx = findTsx();
    if (!tsx) {
      console.error("tsx required to run TypeScript apps.\nInstall: pnpm add -D tsx");
      process.exitCode = 1;
      return;
    }
    const child = spawn(tsx, [appFile], {
      stdio: "inherit",
      env: {
        ...process.env,
        PLUSHIE_TRANSPORT: "socket",
        PLUSHIE_SOCKET: addr,
        ...(token !== undefined ? { PLUSHIE_TOKEN: token } : {}),
        ...(jsonFlag ? { PLUSHIE_FORMAT: "json" } : {}),
        ...(binaryOverride ? { PLUSHIE_BINARY_PATH: binaryOverride } : {}),
      },
    });
    child.on("exit", (code) => {
      process.exitCode = code ?? 1;
    });
  } else {
    // Interactive mode: connect, print hello, keep alive
    const { SocketTransport } = await import("../client/socket_transport.js");
    const { Session } = await import("../client/session.js");

    console.log(`Connecting to ${addr} (${format})...`);
    const transport = new SocketTransport({ address: addr, format });
    const session = new Session(transport);

    try {
      const settings =
        token === undefined
          ? {}
          : { token_sha256: createHash("sha256").update(token).digest("hex") };
      const hello = await session.connect({ timeout: 10_000, settings });
      console.log(`Connected to ${hello.name} v${hello.version} (${hello.mode}, ${hello.backend})`);
      console.log("Session active. Press Ctrl+C to disconnect.");

      process.on("SIGINT", () => {
        session.close();
        process.exit(0);
      });
    } catch (err) {
      console.error(`Connection failed: ${String(err)}`);
      process.exitCode = 1;
    }
  }
}

// =========================================================================
// Script / Replay
// =========================================================================

async function handleScript(
  positional: string[],
  flags: string[],
  binaryOverride: string | undefined,
): Promise<void> {
  const { parseScriptFile, runScript } = await import("../script.js");
  const { resolveBinary } = await import("../client/binary.js");
  const { SpawnTransport } = await import("../client/transport.js");
  const { Session } = await import("../client/session.js");
  const { readdirSync } = await import("node:fs");

  const jsonFlag = flags.includes("--json");
  const format = jsonFlag ? ("json" as const) : ("msgpack" as const);

  // Collect script files: either from positional args or find *.plushie in cwd
  let scriptFiles = positional.filter((p) => p.endsWith(".plushie"));
  if (scriptFiles.length === 0) {
    try {
      scriptFiles = readdirSync(".")
        .filter((f) => f.endsWith(".plushie"))
        .sort();
    } catch {
      // ignore read errors
    }
  }

  if (scriptFiles.length === 0) {
    console.error("No .plushie script files found.");
    console.error("Usage: plushie script [file.plushie ...]");
    process.exitCode = 1;
    return;
  }

  const binary = binaryOverride ?? resolveBinary();
  if (!binary) {
    console.error("plushie binary not found. Run: plushie download");
    process.exitCode = 1;
    return;
  }

  let allPassed = true;

  for (const file of scriptFiles) {
    console.log(`Running ${file}...`);
    const script = parseScriptFile(file);

    const backend = script.header.backend ?? "mock";
    const transport = new SpawnTransport({
      binary,
      format,
      args: [`--${backend}`],
    });
    const session = new Session(transport);

    try {
      await session.connect({ timeout: 10_000 });
      const result = await runScript(script, session);

      if (result.passed) {
        console.log(`  PASS`);
      } else {
        console.log(`  FAIL`);
        for (const failure of result.failures) {
          console.log(`    - ${failure}`);
        }
        allPassed = false;
      }
    } catch (err) {
      console.log(`  ERROR: ${String(err)}`);
      allPassed = false;
    } finally {
      session.close();
    }
  }

  if (!allPassed) {
    process.exitCode = 1;
  }
}

async function handleReplay(
  positional: string[],
  flags: string[],
  binaryOverride: string | undefined,
): Promise<void> {
  const file = positional[0];
  if (!file) {
    console.error("Usage: plushie replay <file.plushie>");
    process.exitCode = 1;
    return;
  }

  const { parseScriptFile, runScript } = await import("../script.js");
  const { resolveBinary } = await import("../client/binary.js");
  const { SpawnTransport } = await import("../client/transport.js");
  const { Session } = await import("../client/session.js");

  const jsonFlag = flags.includes("--json");
  const format = jsonFlag ? ("json" as const) : ("msgpack" as const);

  const binary = binaryOverride ?? resolveBinary();
  if (!binary) {
    console.error("plushie binary not found. Run: plushie download");
    process.exitCode = 1;
    return;
  }

  console.log(`Replaying ${file}...`);
  const script = parseScriptFile(file);

  // Replay always uses windowed mode for real rendering
  const transport = new SpawnTransport({
    binary,
    format,
    args: ["--windowed"],
  });
  const session = new Session(transport);

  try {
    await session.connect({ timeout: 10_000 });
    const result = await runScript(script, session);

    if (result.passed) {
      console.log("Replay complete: PASS");
    } else {
      console.log("Replay complete: FAIL");
      for (const failure of result.failures) {
        console.log(`  - ${failure}`);
      }
      process.exitCode = 1;
    }
  } catch (err) {
    console.error(`Replay error: ${String(err)}`);
    process.exitCode = 1;
  } finally {
    session.close();
  }
}

// =========================================================================
// Package
// =========================================================================

interface LocalPackageJson {
  readonly name?: string;
  readonly version?: string;
}

function readLocalPackageJson(): LocalPackageJson {
  try {
    return JSON.parse(readFileSync(resolve("package.json"), "utf-8")) as LocalPackageJson;
  } catch {
    return {};
  }
}

function parseRendererKind(value: string | undefined): RendererKind | undefined {
  if (value === undefined) return undefined;
  if (value === "stock" || value === "custom") return value;
  throw new Error(`Invalid --renderer-kind value: ${value}`);
}

function defaultHostName(pkg: LocalPackageJson, hostBin: string | undefined): string {
  if (hostBin !== undefined) {
    return basename(hostBin);
  }
  const base = (pkg.name ?? "app").replaceAll(/[^A-Za-z0-9._-]/g, "-");
  const ext = process.platform === "win32" ? ".exe" : "";
  return `${base}-host${ext}`;
}

async function handlePackage(
  valueFlags: Map<string, string>,
  flags: readonly string[],
): Promise<void> {
  const appId = valueFlags.get("--app-id");
  const main = valueFlags.get("--main");
  const hostBin = valueFlags.get("--host-bin");
  if (flags.includes("--write-package-config")) {
    const packageConfig = valueFlags.get("--package-config") ?? "plushie-package.config.toml";
    writePackageStartConfig(packageConfig, defaultPackageStartConfig());
    console.log(`Wrote ${packageConfig}`);
    return;
  }
  if (appId === undefined) {
    console.error("Error: --app-id is required");
    process.exitCode = 1;
    return;
  }
  if (main === undefined && hostBin === undefined) {
    console.error("Error: --main or --host-bin is required");
    process.exitCode = 1;
    return;
  }

  const pkg = readLocalPackageJson();
  const hostName = valueFlags.get("--host-name") ?? defaultHostName(pkg, hostBin);
  const outputDir = valueFlags.get("--output") ?? resolve("dist");
  const appVersion = valueFlags.get("--app-version") ?? pkg.version ?? "0.1.0";
  const rendererKind = valueFlags.has("--renderer-kind")
    ? parseRendererKind(valueFlags.get("--renderer-kind"))
    : undefined;

  const result = prepareNodePackagePayload({
    appId,
    ...(valueFlags.has("--app-name") ? { appName: valueFlags.get("--app-name")! } : {}),
    appVersion,
    ...(main !== undefined ? { main } : {}),
    ...(hostBin !== undefined ? { hostBin } : {}),
    hostName,
    outputDir,
    ...(valueFlags.has("--renderer-path")
      ? { rendererPath: valueFlags.get("--renderer-path")! }
      : {}),
    ...(rendererKind !== undefined ? { rendererKind } : {}),
    ...(valueFlags.has("--package-config")
      ? { packageConfig: valueFlags.get("--package-config")! }
      : {}),
    ...(valueFlags.has("--icon") ? { icon: valueFlags.get("--icon")! } : {}),
    defaultIcon: !valueFlags.has("--icon"),
    ...(valueFlags.has("--target") ? { target: valueFlags.get("--target")! } : {}),
    log: console.log,
  });

  console.log();
  console.log(`Shared launcher payload: ${result.payloadArchivePath}`);
  console.log(`Shared launcher manifest: ${result.manifestPath}`);
  console.log();
  console.log("Build launcher with:");
  console.log(`  bin/plushie package portable --manifest ${result.manifestPath}`);
}

// =========================================================================
// tsx resolution
// =========================================================================

function findTsx(): string | null {
  // Check local node_modules first
  const local = resolve("node_modules", ".bin", "tsx");
  if (existsSync(local)) return local;
  // Check PATH
  const result = spawnSync("which", ["tsx"], { stdio: "pipe" });
  if (result.status === 0) return result.stdout.toString().trim();
  return null;
}

// =========================================================================
// Dev
// =========================================================================

function spawnApp(tsx: string, appFile: string, extraEnv: Record<string, string>): ChildProcess {
  return spawn(tsx, [appFile], {
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
  });
}

function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }

  return new Promise((resolveStop) => {
    const killTimer = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
      }
    }, 2_000);

    child.once("exit", () => {
      clearTimeout(killTimer);
      resolveStop();
    });

    child.kill("SIGTERM");
  });
}

async function runDev(
  appFile: string,
  tsx: string,
  noWatch: boolean,
  extraEnv: Record<string, string>,
): Promise<void> {
  if (noWatch) {
    const child = spawnApp(tsx, appFile, extraEnv);
    process.exitCode = await waitForChild(child);
    return;
  }

  let child: ChildProcess | null = null;
  let reload = Promise.resolve();
  let stoppingChild: Promise<void> | null = null;
  let stoppingProcess: ChildProcess | null = null;
  let shuttingDown = false;

  const startChild = (): void => {
    const next = spawnApp(tsx, appFile, extraEnv);
    next.once("error", (err) => {
      console.error(`[plushie dev] failed to run app: ${String(err)}`);
    });
    child = next;
  };

  const restartChild = async (): Promise<void> => {
    if (shuttingDown) return;
    const previous = child;
    if (previous !== null) {
      stoppingProcess = previous;
      stoppingChild = stopChild(previous);
      try {
        await stoppingChild;
      } finally {
        if (child === previous) {
          child = null;
        }
        stoppingChild = null;
        stoppingProcess = null;
      }
    }
    if (!shuttingDown) {
      startChild();
    }
  };

  const server = new DevServer({
    dirs: [dirname(resolve(appFile))],
    trapSignals: false,
    onReload: () => {
      reload = reload.then(restartChild, restartChild);
    },
  });

  const cleanup = async (): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    server.stop();
    const current = child;
    if (current !== null && current === stoppingProcess && stoppingChild !== null) {
      await stoppingChild;
    } else if (current !== null) {
      child = null;
      await stopChild(current);
    }
    if (stoppingChild !== null) {
      await stoppingChild;
    }
  };

  const exitCleanup = (): void => {
    server.stop();
    if (child !== null && child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
    }
  };

  const handleSignal = (signal: NodeJS.Signals): void => {
    void cleanup().finally(() => {
      process.exit(signal === "SIGINT" ? 130 : 143);
    });
  };

  process.once("SIGINT", handleSignal);
  process.once("SIGTERM", handleSignal);
  process.once("exit", exitCleanup);

  startChild();
  server.start();
}

// =========================================================================
// Main
// =========================================================================

async function main(argv: string[]): Promise<void> {
  const args = argv.slice(2);
  const command = args[0];

  if (command === "--help" || command === "-h" || command === undefined) {
    console.log(USAGE);
    return;
  }

  if (command === "--version" || command === "-v") {
    console.log(readVersion());
    return;
  }

  // Parse flags from the remaining args (after the command).
  // Value flags consume the next arg. Other --flags are boolean.
  const rest = args.slice(1);
  const VALUE_FLAGS = new Set([
    "--binary",
    "--bin-file",
    "--wasm-dir",
    "--token",
    "--app-id",
    "--app-name",
    "--app-version",
    "--main",
    "--host-bin",
    "--host-name",
    "--output",
    "--renderer-kind",
    "--renderer-path",
    "--package-config",
    "--icon",
    "--target",
  ]);
  const flags: string[] = [];
  const positional: string[] = [];
  const valueFlags = new Map<string, string>();
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]!;
    if (VALUE_FLAGS.has(arg) && i + 1 < rest.length) {
      valueFlags.set(arg, rest[i + 1]!);
      flags.push(arg);
      i++; // skip the value
    } else if (arg.startsWith("--")) {
      flags.push(arg);
    } else {
      positional.push(arg);
    }
  }
  const jsonFlag = flags.includes("--json");
  const noWatch = flags.includes("--no-watch");
  const binaryOverride = valueFlags.get("--binary");
  const binFileOverride = valueFlags.get("--bin-file");
  const wasmDirOverride = valueFlags.get("--wasm-dir");
  const tokenOverride = valueFlags.get("--token");

  // Read project config (plushie.extensions.json)
  const projectConfig = readProjectConfig();

  // Build extra env vars from flags
  const extraEnv: Record<string, string> = {};
  if (jsonFlag) extraEnv["PLUSHIE_FORMAT"] = "json";
  if (binaryOverride !== undefined) extraEnv["PLUSHIE_BINARY_PATH"] = binaryOverride;

  switch (command) {
    case "download":
      await handleDownload(flags, binFileOverride, wasmDirOverride, projectConfig);
      break;
    case "build":
      await handleBuild(flags, binFileOverride, wasmDirOverride, projectConfig);
      break;
    case "connect":
      await handleConnect(positional, flags, binaryOverride, tokenOverride);
      break;
    case "script":
      await handleScript(positional, flags, binaryOverride);
      break;
    case "replay":
      await handleReplay(positional, flags, binaryOverride);
      break;
    case "package":
      await handlePackage(valueFlags, flags);
      break;
    case "dev": {
      if (positional[0] === undefined) {
        console.error("Error: missing <app> argument\n");
        console.log(USAGE);
        process.exitCode = 1;
        return;
      }
      const devTsx = findTsx();
      if (!devTsx) {
        console.error("tsx is required for dev mode.\nInstall: pnpm add -D tsx");
        process.exitCode = 1;
        return;
      }
      await runDev(positional[0], devTsx, noWatch, extraEnv);
      break;
    }
    case "run": {
      if (positional[0] === undefined) {
        console.error("Error: missing <app> argument\n");
        console.log(USAGE);
        process.exitCode = 1;
        return;
      }
      const runTsx = findTsx();
      if (!runTsx) {
        console.error("tsx is required to run TypeScript apps directly.\nInstall: pnpm add -D tsx");
        process.exitCode = 1;
        return;
      }
      const runChild = spawn(runTsx, [positional[0]], {
        stdio: "inherit",
        env: { ...process.env, ...extraEnv },
      });
      runChild.on("exit", (code) => {
        process.exitCode = code ?? 1;
      });
      break;
    }
    case "stdio": {
      if (positional[0] === undefined) {
        console.error("Error: missing <app> argument\n");
        console.log(USAGE);
        process.exitCode = 1;
        return;
      }
      const stdioTsx = findTsx();
      if (!stdioTsx) {
        console.error("tsx is required.\nInstall: pnpm add -D tsx");
        process.exitCode = 1;
        return;
      }
      const stdioChild = spawn(stdioTsx, [positional[0]], {
        stdio: "inherit",
        env: { ...process.env, ...extraEnv, PLUSHIE_TRANSPORT: "stdio" },
      });
      stdioChild.on("exit", (code) => {
        process.exitCode = code ?? 1;
      });
      break;
    }
    case "inspect": {
      if (positional[0] === undefined) {
        console.error("Error: missing <app> argument\n");
        console.log(USAGE);
        process.exitCode = 1;
        return;
      }
      const inspectTsx = findTsx();
      if (!inspectTsx) {
        console.error("tsx is required.\nInstall: pnpm add -D tsx");
        process.exitCode = 1;
        return;
      }
      const appPath = resolve(positional[0]);
      const normalizePath = resolve(
        dirname(new URL(import.meta.url).pathname),
        "..",
        "tree",
        "normalize.ts",
      );
      const inspectScript = [
        `import app from '${appPath}';`,
        `import { normalize } from '${normalizePath}';`,
        `const config = app.config;`,
        `const init = Array.isArray(config.init) ? config.init[0] : config.init;`,
        `const tree = config.view(init);`,
        `const wire = normalize(tree);`,
        `console.log(JSON.stringify(wire, null, 2));`,
      ].join("\n");
      const tmpScript = resolve(".plushie-inspect.mts");
      writeFileSync(tmpScript, inspectScript, "utf-8");
      const inspectChild = spawn(inspectTsx, [tmpScript], { stdio: "inherit" });
      inspectChild.on("exit", (code) => {
        try {
          unlinkSync(tmpScript);
        } catch {
          /* ignore */
        }
        process.exitCode = code ?? 1;
      });
      break;
    }
    default:
      console.error(`Unknown command: ${command}\n`);
      console.log(USAGE);
      process.exitCode = 1;
  }
}

void main(process.argv).catch((err) => {
  console.error(String(err instanceof Error ? err.message : err));
  process.exitCode = 1;
});

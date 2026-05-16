/**
 * Standalone package payload helpers.
 *
 * The TypeScript SDK builds the host payload and writes a partial
 * manifest; `cargo plushie package assemble` reads the partial
 * manifest and payload directory to produce the final package.
 *
 * @module
 */

import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, join, resolve } from "node:path";
import { arch, execPath, platform } from "node:process";
import {
  installedBinaryName,
  installedLauncherName,
  installedToolName,
  PLUSHIE_RUST_VERSION,
} from "./client/binary.js";
import { PROTOCOL_VERSION } from "./client/protocol.js";
import { generateSEAConfig } from "./sea.js";

export type RendererKind = "stock" | "custom";
const DEFAULT_PACKAGE_CONFIG = "plushie-package.config.toml";

export interface RendererManifest {
  readonly kind: RendererKind;
  readonly path: string;
}

/** Partial manifest written by the SDK; cargo-plushie completes it. */
export interface PartialPackageManifest {
  readonly appId: string;
  readonly appName?: string;
  readonly appVersion: string;
  readonly target: string;
  readonly renderer: RendererManifest;
  readonly startCommand: readonly string[];
}

export interface ResolvedRenderer {
  readonly kind: RendererKind;
  readonly sourcePath: string;
  readonly payloadPath: string;
}

export interface ResolveRendererOptions {
  readonly rendererPath?: string;
  readonly rendererKind?: RendererKind;
  readonly env?: NodeJS.ProcessEnv;
  readonly log?: (message: string) => void;
}

export interface BuildSEAExecutableOptions {
  readonly main: string;
  readonly output: string;
  readonly nodePath?: string;
  readonly postjectCommand?: string;
}

export interface PrepareNodePackagePayloadOptions {
  readonly appId: string;
  readonly appName?: string;
  readonly appVersion: string;
  readonly main?: string;
  readonly hostBin?: string;
  readonly hostName: string;
  readonly outputDir: string;
  readonly renderer?: ResolvedRenderer;
  readonly rendererPath?: string;
  readonly rendererKind?: RendererKind;
  readonly packageConfig?: string;
  readonly target?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly log?: (message: string) => void;
}

export interface PreparedNodePackagePayload {
  readonly manifest: PartialPackageManifest;
  readonly manifestPath: string;
  readonly payloadDir: string;
  readonly renderer: ResolvedRenderer;
}

export interface PackageStartConfig {
  readonly command: readonly string[];
}

export function normalizePackageTarget(osName: string, cpuName: string): string {
  const osKey = osName.toLowerCase();
  let osPart: string;
  if (osKey.startsWith("linux")) {
    osPart = "linux";
  } else if (osKey.startsWith("darwin") || osKey === "macos") {
    osPart = "darwin";
  } else if (
    osKey === "win32" ||
    osKey === "windows" ||
    osKey === "cygwin" ||
    osKey.startsWith("mingw") ||
    osKey.startsWith("msys")
  ) {
    osPart = "windows";
  } else {
    throw new Error(`unsupported package OS: ${osName}`);
  }

  const cpuKey = cpuName.toLowerCase();
  let cpuPart: string;
  if (cpuKey === "amd64" || cpuKey === "x64" || cpuKey === "x86_64") {
    cpuPart = "x86_64";
  } else if (cpuKey === "arm64" || cpuKey === "aarch64") {
    cpuPart = "aarch64";
  } else {
    throw new Error(`unsupported package architecture: ${cpuName}`);
  }

  return `${osPart}-${cpuPart}`;
}

export function packageTarget(): string {
  return normalizePackageTarget(platform, arch);
}

export function renderPartialManifest(manifest: PartialPackageManifest): string {
  const lines = ["schema_version = 1", `app_id = ${tomlString(manifest.appId)}`];
  if (manifest.appName !== undefined) {
    lines.push(`app_name = ${tomlString(manifest.appName)}`);
  }
  lines.push(
    `app_version = ${tomlString(manifest.appVersion)}`,
    `target = ${tomlString(manifest.target)}`,
    'host_sdk = "typescript"',
    `host_sdk_version = ${tomlString(readSdkVersion())}`,
    `plushie_rust_version = ${tomlString(PLUSHIE_RUST_VERSION)}`,
    `protocol_version = ${String(PROTOCOL_VERSION)}`,
    "",
    "[start]",
    `command = ${tomlArray(manifest.startCommand)}`,
    "",
    "[renderer]",
    `path = ${tomlString(manifest.renderer.path)}`,
    `kind = ${tomlString(manifest.renderer.kind)}`,
    "",
  );
  return lines.join("\n");
}

export function writePartialManifest(path: string, manifest: PartialPackageManifest): void {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  writeFileSync(path, renderPartialManifest(manifest), "utf-8");
}

export function defaultPackageStartConfig(
  command: readonly string[] = ["bin/connect"],
): PackageStartConfig {
  return { command };
}

export function renderPackageStartConfig(
  config: PackageStartConfig = defaultPackageStartConfig(),
): string {
  return [
    "# Plushie standalone package config.",
    "# Commit this file and edit it when the packaged app needs a",
    "# different entry point or forwarded environment.",
    "",
    "config_version = 1",
    "",
    "[start]",
    "# Structured argv. The first item is the packaged host executable.",
    `command = ${tomlArray(config.command)}`,
    "",
    "# [assets]",
    "# # Project-relative directory copied verbatim into the payload root",
    "# # during package assembly. When this section is absent, a directory",
    "# # named `package_assets/` next to this config file is used by",
    "# # convention if it exists.",
    '# dir = "package_assets"',
    "",
    "# Optional platform metadata. All fields are optional; omit the",
    "# [platform] section entirely when none apply.",
    "#",
    "# [platform]",
    '# publisher = "Example Corp"',
    '# copyright = "Copyright 2025 Example Corp"',
    '# category = "public.app-category.productivity"',
    '# description = "A great app"',
    '# bundle_id = "com.example.myapp"',
    "#",
    "# [platform.macos]",
    '# bundle_version = "1"',
    "#",
    "# [platform.windows]",
    '# install_scope = "perUser"   # perUser or perMachine',
    "",
  ].join("\n");
}

export function writePackageStartConfig(
  path = DEFAULT_PACKAGE_CONFIG,
  config: PackageStartConfig = defaultPackageStartConfig(),
): void {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  writeFileSync(path, renderPackageStartConfig(config), "utf-8");
}

export function buildSEAExecutable(opts: BuildSEAExecutableOptions): void {
  const output = resolve(opts.output);
  const seaConfigPath = join(dirname(output), "sea-config.json");
  const seaPrepPath = join(dirname(output), "sea-prep.blob");
  mkdirSync(dirname(output), { recursive: true });

  const config = generateSEAConfig({
    main: opts.main,
    output: seaPrepPath,
  });
  writeFileSync(seaConfigPath, JSON.stringify(config, null, 2), "utf-8");

  try {
    runCommand(opts.nodePath ?? execPath, ["--experimental-sea-config", seaConfigPath]);
    copyFileSync(opts.nodePath ?? execPath, output);

    if (process.platform === "darwin") {
      runCommand("codesign", ["--remove-signature", output], { allowFailure: true });
    }

    runCommand(opts.postjectCommand ?? "npx", [
      ...(opts.postjectCommand === undefined ? ["postject"] : []),
      output,
      "NODE_SEA_BLOB",
      seaPrepPath,
      "--sentinel-fuse",
      "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2",
    ]);

    if (process.platform === "darwin") {
      runCommand("codesign", ["-s", "-", output]);
    }
  } finally {
    rmSync(seaConfigPath, { force: true });
    rmSync(seaPrepPath, { force: true });
  }
}

export function resolvePackageRenderer(opts: ResolveRendererOptions = {}): ResolvedRenderer {
  const env = opts.env ?? process.env;
  const kind = opts.rendererKind ?? "stock";
  const explicitPath = opts.rendererPath ?? env["PLUSHIE_BINARY_PATH"];

  if (explicitPath !== undefined && explicitPath !== "") {
    const sourcePath = resolve(explicitPath);
    validateExecutable(sourcePath, "renderer binary");
    ensurePortablePackageToolsAvailable();
    return {
      kind,
      sourcePath,
      payloadPath: join("bin", basename(sourcePath)),
    };
  }

  if (kind === "custom") {
    throw new Error(
      "custom renderer packaging requires an explicit renderer binary path. " +
        "Pass --renderer-path or set PLUSHIE_BINARY_PATH to a renderer built for this app.",
    );
  }

  const rustSourcePath = env["PLUSHIE_RUST_SOURCE_PATH"];
  if (rustSourcePath !== undefined && rustSourcePath !== "") {
    const sourcePath = syncManagedPackageToolsFromSource(rustSourcePath, env, opts.log);
    validateExecutable(sourcePath, "renderer binary");
    return {
      kind,
      sourcePath,
      payloadPath: join("bin", basename(sourcePath)),
    };
  }

  const syncedPath = syncManagedPackageTools(env, opts.log);
  if (syncedPath !== undefined) {
    validateExecutable(syncedPath, "renderer binary");
    return {
      kind,
      sourcePath: syncedPath,
      payloadPath: join("bin", basename(syncedPath)),
    };
  }

  throw new Error(
    `Error: plushie binary not found.\n` +
      `Run 'npx plushie download' or set PLUSHIE_BINARY_PATH.\n` +
      `Expected: ${resolve("bin", installedBinaryName())}`,
  );
}

export function prepareNodePackagePayload(
  opts: PrepareNodePackagePayloadOptions,
): PreparedNodePackagePayload {
  if (opts.main === undefined && opts.hostBin === undefined) {
    throw new Error("Either main or hostBin is required");
  }
  if (opts.main !== undefined && opts.hostBin !== undefined) {
    throw new Error("main and hostBin cannot be used together");
  }

  const outputDir = resolve(opts.outputDir);
  const log = opts.log ?? (() => {});
  const payloadDir = join(outputDir, "payload-root");
  const manifestPath = join(outputDir, "plushie-package.toml");
  const renderer = opts.renderer ?? resolvePackageRenderer(opts);

  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(join(payloadDir, "bin"), { recursive: true });

  const hostPayloadPath = join(payloadDir, "bin", opts.hostName);
  if (opts.main !== undefined) {
    log("Building host SEA for shared launcher payload...");
    buildSEAExecutable({
      main: opts.main,
      output: hostPayloadPath,
    });
  } else {
    copyFileSync(resolve(opts.hostBin!), hostPayloadPath);
    makeExecutable(hostPayloadPath);
  }

  const rendererPayloadPath = join(payloadDir, renderer.payloadPath);
  mkdirSync(dirname(rendererPayloadPath), { recursive: true });
  copyFileSync(renderer.sourcePath, rendererPayloadPath);
  makeExecutable(rendererPayloadPath);

  const manifest: PartialPackageManifest = {
    appId: opts.appId,
    ...(opts.appName !== undefined ? { appName: opts.appName } : {}),
    appVersion: opts.appVersion,
    target: opts.target ?? packageTarget(),
    renderer: {
      kind: renderer.kind,
      path: renderer.payloadPath,
    },
    startCommand: [join("bin", opts.hostName)],
  };
  writePartialManifest(manifestPath, manifest);

  return {
    manifest,
    manifestPath,
    payloadDir,
    renderer,
  };
}

function readSdkVersion(): string {
  const require = createRequire(import.meta.url);
  const pkg = require("../package.json") as { version: string };
  return pkg.version;
}

function ensurePortablePackageToolsAvailable(): void {
  const missing = [
    resolve("bin", installedToolName()),
    resolve("bin", installedLauncherName()),
  ].filter((path) => !existsSync(path));
  if (missing.length > 0) {
    throw new Error(
      "Portable packaging requires the managed Plushie tool set. " +
        `Missing: ${missing.join(", ")}. Run 'npx plushie download'.`,
    );
  }
}

function syncManagedPackageToolsFromSource(
  rustSourcePath: string,
  env: NodeJS.ProcessEnv,
  log: ((message: string) => void) | undefined,
): string {
  const manifestPath = join(rustSourcePath, "Cargo.toml");
  if (!existsSync(manifestPath)) {
    throw new Error(
      `PLUSHIE_RUST_SOURCE_PATH does not look like a Rust workspace: ${rustSourcePath}`,
    );
  }

  log?.(`Syncing Plushie native tools from ${rustSourcePath}`);
  runCommand(
    "cargo",
    [
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
    ],
    { env: { ...process.env, ...env } },
  );
  return verifyManagedPackageTools(env);
}

function syncManagedPackageTools(
  env: NodeJS.ProcessEnv,
  log: ((message: string) => void) | undefined,
): string | undefined {
  const rendererPath = resolve("bin", installedBinaryName());
  const toolPath = resolve("bin", installedToolName());
  if (!existsSync(toolPath)) {
    if (existsSync(rendererPath)) {
      throw new Error(
        `Cannot package with ${rendererPath} until ${toolPath} is available. ` +
          "Run 'npx plushie download' to sync the managed native tool set.",
      );
    }
    return undefined;
  }

  log?.(`Checking Plushie native tools through ${toolPath}`);
  runCommand(toolPath, ["tools", "sync", "--required-version", PLUSHIE_RUST_VERSION], {
    env,
  });
  return verifyManagedPackageTools(env);
}

function verifyManagedPackageTools(env: NodeJS.ProcessEnv = process.env): string {
  const rendererPath = resolve("bin", installedBinaryName());
  const launcherPath = resolve("bin", installedLauncherName());
  const toolPath = resolve("bin", installedToolName());
  for (const path of [toolPath, rendererPath, launcherPath]) {
    if (!existsSync(path)) {
      throw new Error(`bin/plushie tools sync did not install ${path}`);
    }
  }
  checkManagedPackageTools(env);
  return rendererPath;
}

function checkManagedPackageTools(env: NodeJS.ProcessEnv = process.env): void {
  const toolPath = resolve("bin", installedToolName());
  runCommand(toolPath, ["tools", "check", "--required-version", PLUSHIE_RUST_VERSION], {
    env,
  });
}

export function runCommand(
  command: string,
  args: readonly string[],
  opts: { cwd?: string; env?: NodeJS.ProcessEnv; allowFailure?: boolean } = {},
): void {
  const result = spawnSync(command, [...args], {
    cwd: opts.cwd,
    env: opts.env,
    stdio: opts.allowFailure ? "ignore" : "inherit",
  });
  if (!opts.allowFailure && result.status !== 0) {
    throw new Error(`${command} failed with exit status ${String(result.status ?? 1)}`);
  }
}

function validateExecutable(path: string, label: string): void {
  if (!existsSync(path)) {
    throw new Error(`${label} not found at ${path}`);
  }
  makeExecutable(path);
}

function makeExecutable(path: string): void {
  if (process.platform !== "win32") {
    chmodSync(path, 0o755);
  }
}

function tomlString(value: string): string {
  return JSON.stringify(value);
}

function tomlArray(values: readonly string[]): string {
  return `[${values.map(tomlString).join(", ")}]`;
}

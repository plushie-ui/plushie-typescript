/**
 * Standalone package payload helpers.
 *
 * The shared Rust launcher owns the outer executable. The TypeScript
 * SDK owns the host payload shape and the package manifest values for
 * TypeScript apps.
 *
 * @module
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, isAbsolute, join, resolve, win32 } from "node:path";
import { arch, execPath, platform } from "node:process";
import {
  installedBinaryName,
  installedLauncherName,
  installedToolName,
  PLUSHIE_RUST_VERSION,
} from "./client/binary.js";
import { PACKAGE_READY_FILE_ENV } from "./client/package_ready.js";
import { PROTOCOL_VERSION } from "./client/protocol.js";
import { generateSEAConfig } from "./sea.js";

export type RendererKind = "stock" | "custom";
const DEFAULT_FORWARD_ENV = [
  "PATH",
  "HOME",
  "LANG",
  "LC_ALL",
  "XDG_RUNTIME_DIR",
  "WAYLAND_DISPLAY",
  "DISPLAY",
] as const;
const DEFAULT_PACKAGE_CONFIG = "plushie-package.config.toml";
// Names owned by the launcher or renderer that must not be forwarded from the
// host environment. Forwarding these would let a host environment variable
// silently override launcher-injected values, breaking the packaging contract.
// Any name matching /^PLUSHIE_/ that is not in this list should be added here
// when it becomes a documented launcher- or renderer-owned variable.
const RESERVED_FORWARD_ENV = new Set([
  "PLUSHIE_BINARY_PATH",
  "PLUSHIE_PACKAGE_DIR",
  PACKAGE_READY_FILE_ENV, // PLUSHIE_PACKAGE_READY_FILE
  "PLUSHIE_SOCKET",
  "PLUSHIE_TOKEN",
  "PLUSHIE_TRANSPORT",
  "PLUSHIE_RUST_SOURCE_PATH",
  "PLUSHIE_RELEASE_BASE_URL",
  "PLUSHIE_CACHE_DIR",
  "PLUSHIE_LAUNCHER_PATH",
  "PLUSHIE_TOOL_SOURCE_KIND",
  "PLUSHIE_FORMAT",
  "PLUSHIE_NO_CATCH_UNWIND",
]);

export interface RendererManifest {
  readonly kind: RendererKind;
  readonly path: string;
}

export interface PackageManifest {
  readonly appId: string;
  readonly appName?: string;
  readonly appVersion: string;
  readonly target: string;
  readonly renderer: RendererManifest;
  readonly platform?: PackagePlatformManifest;
  readonly startCommand: readonly string[];
  readonly workingDir: string;
  readonly forwardEnv: readonly string[];
  readonly payloadArchive: string;
  readonly payloadHash: string;
  readonly payloadSize: number;
}

export interface PackageStartConfig {
  readonly workingDir: string;
  readonly command: readonly string[];
  readonly forwardEnv: readonly string[];
}

export interface PackagePlatformManifest {
  readonly icon?: string;
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
  readonly icon?: string;
  readonly defaultIcon?: boolean;
  readonly packageConfig?: string;
  readonly target?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly log?: (message: string) => void;
}

export interface PreparedNodePackagePayload {
  readonly manifest: PackageManifest;
  readonly manifestPath: string;
  readonly payloadArchivePath: string;
  readonly renderer: ResolvedRenderer;
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

export function sha256File(path: string): string {
  const digest = createHash("sha256");
  digest.update(readFileSync(path));
  return digest.digest("hex");
}

export function fileSize(path: string): number {
  return statSync(path).size;
}

export function manifestForPayload(opts: {
  appId: string;
  appName?: string;
  appVersion: string;
  rendererPath: string;
  startCommand: readonly string[];
  payloadArchive: string;
  target?: string;
  rendererKind?: RendererKind;
  platformIcon?: string;
  workingDir?: string;
  forwardEnv?: readonly string[];
}): PackageManifest {
  const archivePath = resolve(opts.payloadArchive);
  return {
    appId: opts.appId,
    ...(opts.appName !== undefined ? { appName: opts.appName } : {}),
    appVersion: opts.appVersion,
    target: opts.target ?? packageTarget(),
    renderer: {
      kind: opts.rendererKind ?? "stock",
      path: opts.rendererPath,
    },
    ...(opts.platformIcon !== undefined ? { platform: { icon: opts.platformIcon } } : {}),
    startCommand: opts.startCommand,
    workingDir: opts.workingDir ?? ".",
    forwardEnv: opts.forwardEnv ?? DEFAULT_FORWARD_ENV,
    payloadArchive: basename(archivePath),
    payloadHash: sha256File(archivePath),
    payloadSize: fileSize(archivePath),
  };
}

export function renderPackageManifest(manifest: PackageManifest): string {
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
    `working_dir = ${tomlString(manifest.workingDir)}`,
    `command = ${tomlArray(manifest.startCommand)}`,
    `forward_env = ${tomlArray(manifest.forwardEnv)}`,
    "",
    "[renderer]",
    `path = ${tomlString(manifest.renderer.path)}`,
    `kind = ${tomlString(manifest.renderer.kind)}`,
    "",
  );
  if (manifest.platform?.icon !== undefined) {
    lines.push("[platform]", `icon = ${tomlString(manifest.platform.icon)}`, "");
  }
  lines.push(
    "[payload]",
    `archive = ${tomlString(manifest.payloadArchive)}`,
    `hash = ${tomlString(`sha256:${manifest.payloadHash}`)}`,
    `size = ${String(manifest.payloadSize)}`,
    "",
  );
  return lines.join("\n");
}

export function readPackageStartConfig(
  path = DEFAULT_PACKAGE_CONFIG,
): PackageStartConfig | undefined {
  if (!existsSync(path)) return undefined;
  const config = parsePackageStartConfig(readFileSync(path, "utf-8"), path);
  validatePackageStartConfig(config, path);
  return config;
}

export function defaultPackageStartConfig(
  command: readonly string[] = ["bin/connect"],
): PackageStartConfig {
  return {
    workingDir: ".",
    command,
    forwardEnv: [...DEFAULT_FORWARD_ENV],
  };
}

export function renderPackageStartConfig(
  config: PackageStartConfig = defaultPackageStartConfig(),
): string {
  validatePackageStartConfig(config, DEFAULT_PACKAGE_CONFIG);
  return [
    "# Plushie standalone package config.",
    "# Commit this file and edit it when the packaged app needs a",
    "# different entry point, working directory, or forwarded environment.",
    "",
    "config_version = 1",
    "",
    "[start]",
    "# Relative to the extracted app package.",
    `working_dir = ${tomlString(config.workingDir)}`,
    "# Structured argv. The first item is the packaged host executable.",
    `command = ${tomlArray(config.command)}`,
    "# Environment variable names copied from the parent process.",
    `forward_env = ${tomlArray(config.forwardEnv)}`,
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

export function writePackageManifest(path: string, manifest: PackageManifest): void {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  writeFileSync(path, renderPackageManifest(manifest), "utf-8");
}

export function archivePayload(payloadDir: string, archivePath: string): void {
  const resolvedPayloadDir = resolve(payloadDir);
  const resolvedArchivePath = resolve(archivePath);
  validatePayloadArchiveInputs(resolvedPayloadDir);
  mkdirSync(dirname(resolvedArchivePath), { recursive: true });

  const tar = archiveTarCommand();
  if (!archiveTarSupportsGnuFlags(tar)) {
    throw new Error("GNU tar or gtar is required for deterministic payload archives");
  }

  const commonArgs = [
    "-C",
    resolvedPayloadDir,
    "--sort=name",
    "--mtime=UTC 1970-01-01",
    "--owner=0",
    "--group=0",
    "--numeric-owner",
  ];

  if (tarSupportsZstd(tar)) {
    runCommand(tar, [...commonArgs, "--zstd", "-cf", resolvedArchivePath, "."]);
    return;
  }

  if (commandExists("zstd")) {
    if (process.platform === "win32") {
      throw new Error(
        "tar does not support --zstd and the fallback archive pipeline requires a Unix shell. " +
          "Install GNU tar with --zstd support for Windows package assembly.",
      );
    }
    runCommand("sh", [
      "-c",
      `${shellQuote(tar)} ${commonArgs.map(shellQuote).join(" ")} -cf - . | zstd -q -o ${shellQuote(resolvedArchivePath)}`,
    ]);
    return;
  }

  throw new Error("missing required command: zstd");
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
  const payloadRoot = join(outputDir, "payload-root");
  const archivePath = join(outputDir, "payload.tar.zst");
  const manifestPath = join(outputDir, "plushie-package.toml");
  const renderer = opts.renderer ?? resolvePackageRenderer(opts);
  if (opts.packageConfig !== undefined && !existsSync(opts.packageConfig)) {
    throw new Error(`package config not found at ${opts.packageConfig}`);
  }
  const startConfig =
    opts.packageConfig !== undefined
      ? readPackageStartConfig(opts.packageConfig)
      : readPackageStartConfig();

  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(join(payloadRoot, "bin"), { recursive: true });

  const hostPayloadPath = join(payloadRoot, "bin", opts.hostName);
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

  const rendererPayloadPath = join(payloadRoot, renderer.payloadPath);
  mkdirSync(dirname(rendererPayloadPath), { recursive: true });
  copyFileSync(renderer.sourcePath, rendererPayloadPath);
  makeExecutable(rendererPayloadPath);

  const platformIcon = preparePlatformIcon(payloadRoot, opts);

  log("Compressing shared launcher payload...");
  archivePayload(payloadRoot, archivePath);

  const manifest = manifestForPayload({
    appId: opts.appId,
    ...(opts.appName !== undefined ? { appName: opts.appName } : {}),
    appVersion: opts.appVersion,
    ...(opts.target !== undefined ? { target: opts.target } : {}),
    rendererKind: renderer.kind,
    rendererPath: renderer.payloadPath,
    startCommand: startConfig?.command ?? [join("bin", opts.hostName)],
    workingDir: startConfig?.workingDir ?? ".",
    ...(startConfig !== undefined ? { forwardEnv: startConfig.forwardEnv } : {}),
    ...(platformIcon !== undefined ? { platformIcon } : {}),
    payloadArchive: archivePath,
  });
  writePackageManifest(manifestPath, manifest);
  rmSync(payloadRoot, { recursive: true, force: true });

  return {
    manifest,
    manifestPath,
    payloadArchivePath: archivePath,
    renderer,
  };
}

function readSdkVersion(): string {
  const require = createRequire(import.meta.url);
  const pkg = require("../package.json") as { version: string };
  return pkg.version;
}

function parsePackageStartConfig(source: string, path: string): PackageStartConfig {
  let table = "";
  let configVersion: number | undefined;
  const start: Partial<{
    workingDir: string;
    command: readonly string[];
    forwardEnv: readonly string[];
  }> = {};

  for (const statement of packageConfigStatements(source, path)) {
    const line = statement.text;
    const tableMatch = line.match(/^\[([A-Za-z0-9_-]+)\]$/);
    if (tableMatch !== null) {
      table = tableMatch[1]!;
      continue;
    }

    const match = line.match(/^([A-Za-z0-9_-]+)\s*=\s*([\s\S]+)$/);
    if (match === null) {
      throw new Error(`${path}:${String(statement.line)}: unsupported package config syntax`);
    }

    const key = match[1]!;
    const value = match[2]!.trim();
    if (table === "" && key === "config_version") {
      configVersion = parseConfigVersion(value, path, statement.line);
    } else if (table === "start" && key === "working_dir") {
      start.workingDir = parseTomlString(value, path, statement.line);
    } else if (table === "start" && key === "command") {
      start.command = parseTomlStringArray(value, path, statement.line);
    } else if (table === "start" && key === "forward_env") {
      start.forwardEnv = parseTomlStringArray(value, path, statement.line);
    } else {
      throw new Error(`${path}:${String(statement.line)}: unsupported package config key: ${key}`);
    }
  }

  if (configVersion !== 1) {
    throw new Error(`${path}: package config requires config_version = 1`);
  }
  if (start.workingDir === undefined) {
    throw new Error(`${path}: package config missing [start].working_dir`);
  }
  if (start.command === undefined) {
    throw new Error(`${path}: package config missing [start].command`);
  }
  if (start.forwardEnv === undefined) {
    throw new Error(`${path}: package config missing [start].forward_env`);
  }

  return {
    workingDir: start.workingDir,
    command: start.command,
    forwardEnv: start.forwardEnv,
  };
}

function packageConfigStatements(
  source: string,
  path: string,
): Array<{ readonly line: number; readonly text: string }> {
  const statements: Array<{ readonly line: number; readonly text: string }> = [];
  let pending: { line: number; parts: string[] } | undefined;

  for (const [index, rawLine] of source.split(/\r?\n/).entries()) {
    const lineNumber = index + 1;
    const line = stripTomlComment(rawLine).trim();
    if (line === "" && pending === undefined) continue;

    if (pending !== undefined) {
      if (line !== "") pending.parts.push(line);
      const text = pending.parts.join("\n");
      if (tomlBracketDepth(text) <= 0) {
        statements.push({ line: pending.line, text });
        pending = undefined;
      }
      continue;
    }

    if (line.match(/^\[([A-Za-z0-9_-]+)\]$/) !== null || tomlBracketDepth(line) <= 0) {
      statements.push({ line: lineNumber, text: line });
    } else {
      pending = { line: lineNumber, parts: [line] };
    }
  }

  if (pending !== undefined) {
    throw new Error(`${path}:${String(pending.line)}: unterminated package config value`);
  }

  return statements;
}

function stripTomlComment(line: string): string {
  let inString = false;
  let escaped = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
    } else if (char === '"') {
      inString = true;
    } else if (char === "#") {
      return line.slice(0, i);
    }
  }
  return line;
}

function tomlBracketDepth(value: string): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < value.length; i++) {
    const char = value[i]!;
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
    } else if (char === '"') {
      inString = true;
    } else if (char === "[") {
      depth += 1;
    } else if (char === "]") {
      depth -= 1;
    }
  }
  return depth;
}

function parseConfigVersion(value: string, path: string, lineNumber: number): number {
  if (!/^[0-9]+$/.test(value)) {
    throw new Error(`${path}:${lineNumber}: config_version must be an integer`);
  }
  return Number(value);
}

function parseTomlString(value: string, path: string, lineNumber: number): string {
  const parsed = parseTomlValue(value, path, lineNumber);
  if (typeof parsed !== "string") {
    throw new Error(`${path}:${lineNumber}: expected string value`);
  }
  return parsed;
}

function parseTomlStringArray(value: string, path: string, lineNumber: number): readonly string[] {
  const parsed = parseTomlValue(value, path, lineNumber);
  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string")) {
    throw new Error(`${path}:${lineNumber}: expected string array value`);
  }
  return parsed as string[];
}

function parseTomlValue(value: string, path: string, lineNumber: number): unknown {
  const trimmed = value.trim();
  if (trimmed.startsWith("[")) {
    return parseTomlArray(trimmed, path, lineNumber);
  }
  return parseTomlScalar(trimmed, path, lineNumber);
}

function parseTomlArray(value: string, path: string, lineNumber: number): unknown[] {
  if (!value.startsWith("[") || !value.endsWith("]")) {
    throw new Error(`${path}:${lineNumber}: unsupported package config value`);
  }

  const items: unknown[] = [];
  let index = 1;
  let expectingValue = true;
  while (index < value.length - 1) {
    index = skipTomlWhitespace(value, index);
    if (index >= value.length - 1) break;

    const char = value[index]!;
    if (char === ",") {
      if (expectingValue) {
        throw new Error(`${path}:${lineNumber}: unsupported package config value`);
      }
      expectingValue = true;
      index += 1;
      continue;
    }
    if (!expectingValue) {
      throw new Error(`${path}:${lineNumber}: unsupported package config value`);
    }

    const parsed = parseTomlArrayItem(value, index, path, lineNumber);
    items.push(parsed.value);
    index = parsed.next;
    expectingValue = false;
  }

  return items;
}

function parseTomlArrayItem(
  value: string,
  start: number,
  path: string,
  lineNumber: number,
): { readonly value: unknown; readonly next: number } {
  if (value[start] === '"') {
    const end = findTomlStringEnd(value, start, path, lineNumber);
    return {
      value: parseTomlBasicString(value.slice(start, end + 1), path, lineNumber),
      next: end + 1,
    };
  }

  let end = start;
  while (end < value.length - 1 && value[end] !== "," && value[end] !== "]") {
    end += 1;
  }
  return {
    value: parseTomlScalar(value.slice(start, end).trim(), path, lineNumber),
    next: end,
  };
}

function skipTomlWhitespace(value: string, start: number): number {
  let index = start;
  while (index < value.length && /\s/.test(value[index]!)) {
    index += 1;
  }
  return index;
}

function parseTomlScalar(value: string, path: string, lineNumber: number): unknown {
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^[+-]?[0-9]+$/.test(value)) return Number(value);
  if (/^[+-]?[0-9]+\.[0-9]+$/.test(value)) return Number(value);
  if (value.startsWith('"')) return parseTomlBasicString(value, path, lineNumber);
  throw new Error(`${path}:${lineNumber}: unsupported package config value`);
}

function parseTomlBasicString(value: string, path: string, lineNumber: number): string {
  try {
    return JSON.parse(value) as string;
  } catch {
    throw new Error(`${path}:${lineNumber}: unsupported package config value`);
  }
}

function findTomlStringEnd(value: string, start: number, path: string, lineNumber: number): number {
  let escaped = false;
  for (let index = start + 1; index < value.length; index++) {
    const char = value[index]!;
    if (escaped) {
      escaped = false;
    } else if (char === "\\") {
      escaped = true;
    } else if (char === '"') {
      return index;
    }
  }
  throw new Error(`${path}:${lineNumber}: unsupported package config value`);
}

function validatePackageStartConfig(config: PackageStartConfig, path: string): void {
  validateRelativePackagePath(config.workingDir, "working_dir", path);
  if (config.command.length === 0) {
    throw new Error(`${path}: [start].command must not be empty`);
  }
  for (const [index, arg] of config.command.entries()) {
    if (arg === "") {
      throw new Error(`${path}: [start].command[${String(index)}] must not be empty`);
    }
  }
  validateRelativePackagePath(config.command[0]!, "command[0]", path);
  for (const name of config.forwardEnv) {
    if (name === "" || name.includes(",") || name.includes("=")) {
      throw new Error(`${path}: invalid [start].forward_env name: ${name}`);
    }
    if (RESERVED_FORWARD_ENV.has(name)) {
      throw new Error(`${path}: [start].forward_env cannot include reserved name: ${name}`);
    }
  }
}

function validateRelativePackagePath(value: string, label: string, path: string): void {
  if (value === "") {
    throw new Error(`${path}: [start].${label} must not be empty`);
  }
  if (isAbsolute(value) || win32.isAbsolute(value)) {
    throw new Error(`${path}: [start].${label} must be relative`);
  }
  if (value.split(/[\\/]+/).includes("..")) {
    throw new Error(`${path}: [start].${label} must not contain parent traversal`);
  }
}

function preparePlatformIcon(
  payloadRoot: string,
  opts: PrepareNodePackagePayloadOptions,
): string | undefined {
  if (opts.icon !== undefined && opts.defaultIcon === true) {
    throw new Error("icon and defaultIcon cannot both be set");
  }

  if (opts.icon !== undefined) {
    const iconPath = resolve(opts.icon);
    const payloadPath = join("assets", basename(iconPath));
    const dest = join(payloadRoot, payloadPath);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(iconPath, dest);
    return payloadPath;
  }

  if (opts.defaultIcon === true) {
    const assetsDir = join(payloadRoot, "assets");
    writeDefaultIcons(assetsDir, opts.env);
    return join("assets", "plushie-checkbox-512x512.png");
  }

  return undefined;
}

function writeDefaultIcons(outDir: string, env: NodeJS.ProcessEnv | undefined): void {
  const rustSourcePath =
    env?.["PLUSHIE_RUST_SOURCE_PATH"] ?? process.env["PLUSHIE_RUST_SOURCE_PATH"];
  if (rustSourcePath !== undefined && rustSourcePath !== "") {
    runCommand("cargo", [
      "run",
      "--manifest-path",
      join(rustSourcePath, "Cargo.toml"),
      "-p",
      "cargo-plushie",
      "--bin",
      "plushie",
      "--release",
      "--",
      "default-icons",
      "--out",
      outDir,
    ]);
    return;
  }

  runCommand(
    resolve("bin", installedToolName()),
    ["default-icons", "--out", outDir],
    env === undefined ? {} : { env },
  );
}

function validatePayloadArchiveInputs(payloadDir: string): void {
  walk(payloadDir, (path) => {
    const info = lstatSync(path);
    if (info.isSymbolicLink()) {
      throw new Error(`payload contains unsupported symlink: ${relativeWithin(payloadDir, path)}`);
    }
    if (!info.isDirectory() && !info.isFile()) {
      throw new Error(
        `payload contains unsupported special file: ${relativeWithin(payloadDir, path)}`,
      );
    }
    if (info.isFile() && info.nlink > 1) {
      throw new Error(
        `payload contains unsupported hard-linked file: ${relativeWithin(payloadDir, path)}`,
      );
    }
  });
}

function walk(path: string, visit: (path: string) => void): void {
  visit(path);
  if (!lstatSync(path).isDirectory()) return;
  for (const entry of readdirSync(path)) {
    walk(join(path, entry), visit);
  }
}

function archiveTarCommand(): string {
  if (gnuTar("tar")) return "tar";
  if (commandExists("gtar") && gnuTar("gtar")) return "gtar";
  return "tar";
}

function archiveTarSupportsGnuFlags(tar: string): boolean {
  return gnuTar(tar);
}

function gnuTar(command: string): boolean {
  const result = spawnSync(command, ["--version"], { encoding: "utf-8", stdio: "pipe" });
  return result.status === 0 && result.stdout.includes("GNU tar");
}

function tarSupportsZstd(command: string): boolean {
  const result = spawnSync(command, ["--help"], { encoding: "utf-8", stdio: "pipe" });
  return result.status === 0 && result.stdout.includes("--zstd");
}

function commandExists(command: string): boolean {
  if (process.platform === "win32") {
    return spawnSync("where", [command], { stdio: "ignore" }).status === 0;
  }
  const result = spawnSync("sh", ["-c", `command -v ${shellQuote(command)}`], {
    stdio: "ignore",
  });
  return result.status === 0;
}

function runCommand(
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

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function relativeWithin(root: string, path: string): string {
  const relative = path.slice(root.length).replace(/^[/\\]/, "");
  return relative === "" ? "." : relative;
}

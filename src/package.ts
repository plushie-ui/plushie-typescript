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
import { basename, dirname, join, resolve } from "node:path";
import { arch, execPath, platform } from "node:process";
import { PLUSHIE_RUST_VERSION, platformBinaryName } from "./client/binary.js";
import { PROTOCOL_VERSION } from "./client/protocol.js";
import { generateSEAConfig } from "./sea.js";

export type RendererKind = "stock" | "custom";
export type RendererSource = "local-resolve" | "local-build" | "local-path" | string;

export interface RendererManifest {
  readonly kind: RendererKind;
  readonly source: RendererSource;
  readonly path: string;
}

export interface PackageManifest {
  readonly appId: string;
  readonly appName?: string;
  readonly appVersion: string;
  readonly target: string;
  readonly renderer: RendererManifest;
  readonly hostCommand: readonly string[];
  readonly workingDir: string;
  readonly payloadArchive: string;
  readonly payloadHash: string;
  readonly payloadSize: number;
}

export interface ResolvedRenderer {
  readonly kind: RendererKind;
  readonly source: RendererSource;
  readonly sourcePath: string;
  readonly payloadPath: string;
}

export interface ResolveRendererOptions {
  readonly rendererBin?: string;
  readonly rendererKind?: RendererKind;
  readonly rendererSource?: RendererSource;
  readonly env?: NodeJS.ProcessEnv;
  readonly log?: (message: string) => void;
}

export interface BuildSEAExecutableOptions {
  readonly main: string;
  readonly output: string;
  readonly binaryPath?: string;
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
  readonly rendererBin?: string;
  readonly rendererKind?: RendererKind;
  readonly rendererSource?: RendererSource;
  readonly seaOutput?: string;
  readonly target?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly log?: (message: string) => void;
}

export interface PreparedNodePackagePayload {
  readonly manifest: PackageManifest;
  readonly manifestPath: string;
  readonly payloadArchivePath: string;
  readonly seaOutput?: string;
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
  hostCommand: readonly string[];
  payloadArchive: string;
  target?: string;
  rendererKind?: RendererKind;
  rendererSource?: RendererSource;
  workingDir?: string;
}): PackageManifest {
  const archivePath = resolve(opts.payloadArchive);
  return {
    appId: opts.appId,
    ...(opts.appName !== undefined ? { appName: opts.appName } : {}),
    appVersion: opts.appVersion,
    target: opts.target ?? packageTarget(),
    renderer: {
      kind: opts.rendererKind ?? "stock",
      source: opts.rendererSource ?? "local-resolve",
      path: opts.rendererPath,
    },
    hostCommand: opts.hostCommand,
    workingDir: opts.workingDir ?? ".",
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
    `renderer_path = ${tomlString(manifest.renderer.path)}`,
    `host_command = ${tomlArray(manifest.hostCommand)}`,
    `working_dir = ${tomlString(manifest.workingDir)}`,
    "exec_env = []",
    "",
    "[renderer]",
    `kind = ${tomlString(manifest.renderer.kind)}`,
    `source = ${tomlString(manifest.renderer.source)}`,
    "",
    "[payload]",
    `archive = ${tomlString(manifest.payloadArchive)}`,
    `hash = ${tomlString(`sha256:${manifest.payloadHash}`)}`,
    `size = ${String(manifest.payloadSize)}`,
    "",
  );
  return lines.join("\n");
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
    ...(opts.binaryPath !== undefined ? { binaryPath: opts.binaryPath } : {}),
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
  const source = opts.rendererSource ?? (opts.rendererBin ? "local-path" : "local-resolve");
  const explicitPath = opts.rendererBin ?? env["PLUSHIE_BINARY_PATH"];

  if (explicitPath !== undefined && explicitPath !== "") {
    const sourcePath = resolve(explicitPath);
    validateExecutable(sourcePath, "renderer binary");
    return {
      kind,
      source,
      sourcePath,
      payloadPath: join("bin", basename(sourcePath)),
    };
  }

  const rustSourcePath = env["PLUSHIE_RUST_SOURCE_PATH"];
  if (rustSourcePath !== undefined && rustSourcePath !== "") {
    const manifestPath = join(rustSourcePath, "Cargo.toml");
    if (!existsSync(manifestPath)) {
      throw new Error(
        `PLUSHIE_RUST_SOURCE_PATH does not look like a Rust workspace: ${rustSourcePath}`,
      );
    }
    opts.log?.(`Building plushie-renderer from ${rustSourcePath}`);
    runCommand("cargo", ["build", "--release", "-p", "plushie-renderer"], {
      cwd: rustSourcePath,
    });
    const sourcePath = join(
      rustSourcePath,
      "target",
      "release",
      process.platform === "win32" ? "plushie-renderer.exe" : "plushie-renderer",
    );
    validateExecutable(sourcePath, "renderer binary");
    return {
      kind,
      source,
      sourcePath,
      payloadPath: join("bin", basename(sourcePath)),
    };
  }

  const downloadedPath = resolve("node_modules", ".plushie", "bin", platformBinaryName());
  if (existsSync(downloadedPath)) {
    validateExecutable(downloadedPath, "renderer binary");
    return {
      kind,
      source,
      sourcePath: downloadedPath,
      payloadPath: join("bin", basename(downloadedPath)),
    };
  }

  throw new Error(
    `Error: plushie binary not found.\n` +
      `Run 'npx plushie download' or set PLUSHIE_BINARY_PATH.\n` +
      `Expected: ${downloadedPath}`,
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
  const payloadRoot = join(outputDir, "payload-root");
  const archivePath = join(outputDir, "payload.tar.zst");
  const manifestPath = join(outputDir, "plushie-package.toml");
  const renderer = opts.renderer ?? resolvePackageRenderer(opts);

  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(join(payloadRoot, "bin"), { recursive: true });

  if (opts.main !== undefined && opts.seaOutput !== undefined) {
    log("Building SEA with embedded renderer...");
    buildSEAExecutable({
      main: opts.main,
      output: opts.seaOutput,
      binaryPath: renderer.sourcePath,
    });
  }

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

  log("Compressing shared launcher payload...");
  archivePayload(payloadRoot, archivePath);

  const manifest = manifestForPayload({
    appId: opts.appId,
    ...(opts.appName !== undefined ? { appName: opts.appName } : {}),
    appVersion: opts.appVersion,
    ...(opts.target !== undefined ? { target: opts.target } : {}),
    rendererKind: renderer.kind,
    rendererSource: renderer.source,
    rendererPath: renderer.payloadPath,
    hostCommand: [join("bin", opts.hostName)],
    workingDir: ".",
    payloadArchive: archivePath,
  });
  writePackageManifest(manifestPath, manifest);
  rmSync(payloadRoot, { recursive: true, force: true });

  return {
    manifest,
    manifestPath,
    payloadArchivePath: archivePath,
    ...(opts.seaOutput !== undefined ? { seaOutput: resolve(opts.seaOutput) } : {}),
    renderer,
  };
}

function readSdkVersion(): string {
  const require = createRequire(import.meta.url);
  const pkg = require("../package.json") as { version: string };
  return pkg.version;
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
  opts: { cwd?: string; allowFailure?: boolean } = {},
): void {
  const result = spawnSync(command, [...args], {
    cwd: opts.cwd,
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

#!/usr/bin/env node

/**
 * CLI entry point for the plushie SDK.
 *
 * Commands:
 *   plushie download        -- download the precompiled binary
 *   plushie download --wasm -- download the WASM renderer
 *   plushie build           -- build plushie from Rust source
 *   plushie build --wasm    -- build WASM renderer via wasm-pack
 *   plushie dev <app>       -- run an app with file watching
 *   plushie run <app>       -- run an app
 *   plushie stdio <app>     -- run in stdio transport mode (for plushie --exec)
 *   plushie inspect <app>   -- print the initial view tree as JSON
 *   plushie connect <addr>  -- connect to a plushie --listen instance
 *   plushie script          -- run .plushie test scripts
 *   plushie replay <file>   -- replay a .plushie script with real windows
 *   plushie --help          -- print usage
 *   plushie --version       -- print version
 *
 * @module
 */

import { spawn, spawnSync } from "node:child_process";
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { get as httpsGet } from "node:https";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import {
  RELEASE_BASE_URL as BASE_URL,
  BINARY_VERSION,
  downloadBinary as downloadBinaryAPI,
  platformBinaryName,
} from "../client/binary.js";
import { DEFAULT_WASM_DIR, WASM_BG_FILE, WASM_JS_FILE } from "../wasm.js";

function readVersion(): string {
  const require = createRequire(import.meta.url);
  const pkg = require("../../package.json") as { version: string };
  return pkg.version;
}

const USAGE = `\
Usage: plushie <command> [options]

Commands:
  download          Download the precompiled plushie binary
  download --wasm   Download the WASM renderer
  build             Build plushie from Rust source (requires PLUSHIE_SOURCE_PATH)
  build --wasm      Build WASM renderer via wasm-pack
  build --release   Build with optimizations
  dev <app>         Run an app with file watching (hot reload)
  run <app>         Run an app
  stdio <app>       Run an app in stdio transport mode (for plushie --exec)
  inspect <app>     Print the initial view tree as formatted JSON
  connect <addr>    Connect to a plushie --listen instance
  script [files]    Run .plushie test scripts
  replay <file>     Replay a .plushie script with real windows

Options:
  --help            Show this help message
  --version         Show version number
  --json            Use JSON wire format (default: msgpack)
  --binary <path>   Override binary path
  --no-watch        Disable file watching in dev mode
  --release         Build with optimizations (build command)`;

// =========================================================================
// Download
// =========================================================================

/**
 * Follow redirects and download a URL to a file.
 * GitHub releases redirect to S3, so we need to follow 302s.
 */
function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const follow = (currentUrl: string, depth = 0) => {
      if (depth > 5) {
        reject(new Error("Too many redirects"));
        return;
      }

      httpsGet(currentUrl, { headers: { "User-Agent": "plushie-ts-sdk" } }, (res) => {
        // Follow redirects
        if ((res.statusCode === 301 || res.statusCode === 302) && res.headers["location"]) {
          follow(res.headers["location"], depth + 1);
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${String(res.statusCode)} downloading ${currentUrl}`));
          return;
        }

        const dir = dirname(destPath);
        mkdirSync(dir, { recursive: true });

        const file = createWriteStream(destPath);
        res.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
        file.on("error", reject);
      }).on("error", reject);
    };

    follow(url);
  });
}

/**
 * Download a file and verify its SHA256 checksum.
 */
async function downloadWithChecksum(url: string, destPath: string, label: string): Promise<void> {
  const checksumUrl = `${url}.sha256`;

  process.stdout.write(`  Downloading ${label}...`);
  await downloadFile(url, destPath);
  console.log(" done");

  // Download and verify checksum
  try {
    const checksumPath = `${destPath}.sha256`;
    await downloadFile(checksumUrl, checksumPath);

    const { createHash } = await import("node:crypto");
    const fileData = readFileSync(destPath);
    const actualHash = createHash("sha256").update(fileData).digest("hex");
    const expectedHash = readFileSync(checksumPath, "utf-8").trim().split(/\s+/)[0] ?? "";

    if (actualHash !== expectedHash) {
      console.error(`  WARNING: SHA256 mismatch for ${label}`);
      console.error(`    expected: ${expectedHash}`);
      console.error(`    actual:   ${actualHash}`);
    } else {
      console.log(`  SHA256 verified: ${actualHash.slice(0, 16)}...`);
    }
  } catch {
    // Checksum verification is best-effort
    console.log("  (checksum verification skipped)");
  }
}

async function handleDownload(flags: string[]): Promise<void> {
  const isWasm = flags.includes("--wasm");
  const force = flags.includes("--force");

  if (isWasm) {
    await downloadWasm(force);
  } else {
    await handleDownloadBinary(force);
  }
}

async function handleDownloadBinary(force: boolean): Promise<void> {
  const binaryName = platformBinaryName();
  const destDir = resolve("node_modules", ".plushie", "bin");
  const destPath = join(destDir, binaryName);
  const url = `${BASE_URL}/v${BINARY_VERSION}/${binaryName}`;

  if (!force && existsSync(destPath)) {
    console.log(`Binary already exists at ${destPath}`);
    console.log("Use --force to re-download.");
    return;
  }

  console.log(`Downloading plushie binary v${BINARY_VERSION}`);
  console.log(`  Platform: ${binaryName}`);
  console.log(`  From: ${url}`);
  console.log();

  // Use the programmatic API for the actual download
  const resultPath = await downloadBinaryAPI({ destDir, force: true });

  // Verify checksum on top of the API download
  const checksumUrl = `${url}.sha256`;
  try {
    const checksumPath = `${resultPath}.sha256`;
    await downloadFile(checksumUrl, checksumPath);

    const { createHash } = await import("node:crypto");
    const fileData = readFileSync(resultPath);
    const actualHash = createHash("sha256").update(fileData).digest("hex");
    const expectedHash = readFileSync(checksumPath, "utf-8").trim().split(/\s+/)[0] ?? "";

    if (actualHash !== expectedHash) {
      console.error(`  WARNING: SHA256 mismatch for ${binaryName}`);
      console.error(`    expected: ${expectedHash}`);
      console.error(`    actual:   ${actualHash}`);
    } else {
      console.log(`  SHA256 verified: ${actualHash.slice(0, 16)}...`);
    }
  } catch {
    console.log("  (checksum verification skipped)");
  }

  console.log();
  console.log(`Binary installed to ${resultPath}`);
}

async function downloadWasm(force: boolean): Promise<void> {
  const destDir = resolve(DEFAULT_WASM_DIR);
  const tarUrl = `${BASE_URL}/v${BINARY_VERSION}/plushie-wasm.tar.gz`;
  const tarPath = join(destDir, "plushie-wasm.tar.gz");

  if (
    !force &&
    existsSync(join(destDir, WASM_JS_FILE)) &&
    existsSync(join(destDir, WASM_BG_FILE))
  ) {
    console.log(`WASM files already exist in ${destDir}`);
    console.log("Use --force to re-download.");
    return;
  }

  console.log(`Downloading plushie WASM renderer v${BINARY_VERSION}`);
  console.log(`  From: ${tarUrl}`);
  console.log();

  await downloadWithChecksum(tarUrl, tarPath, "plushie-wasm.tar.gz");

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

function handleBuild(flags: string[]): void {
  const sourcePath = process.env["PLUSHIE_SOURCE_PATH"];
  if (!sourcePath) {
    console.error("PLUSHIE_SOURCE_PATH must be set to the plushie Rust source directory.");
    process.exitCode = 1;
    return;
  }

  const isWasm = flags.includes("--wasm");
  const isRelease = flags.includes("--release");

  // Check for extension config (plushie.extensions.json)
  const extConfigPath = resolve("plushie.extensions.json");
  if (!isWasm && existsSync(extConfigPath)) {
    if (handleExtensionBuild(sourcePath, extConfigPath, isRelease)) {
      return; // Extension build handled it
    }
    // No native extensions found -- fall through to stock build
  }

  if (isWasm) {
    const wpCheck = spawnSync("which", ["wasm-pack"], { stdio: "pipe" });
    if (wpCheck.status !== 0) {
      console.error(
        "wasm-pack is required for WASM builds.\n" +
          "Install: https://rustwasm.github.io/wasm-pack/installer/",
      );
      process.exitCode = 1;
      return;
    }
    const wasmDir = resolve(sourcePath, "plushie-wasm");
    const buildArgs = ["build", "--target", "web"];
    if (isRelease) {
      buildArgs.push("--release");
    } else {
      buildArgs.push("--dev");
    }
    console.log(`Building WASM renderer in ${wasmDir}...`);
    const child = spawn("wasm-pack", buildArgs, { cwd: wasmDir, stdio: "inherit" });
    child.on("exit", (code) => {
      if (code === 0) {
        // Install WASM output to the project's wasm directory
        const pkgDir = resolve(wasmDir, "pkg");
        const destDir = resolve(DEFAULT_WASM_DIR);
        mkdirSync(destDir, { recursive: true });
        for (const name of [WASM_JS_FILE, WASM_BG_FILE]) {
          const src = join(pkgDir, name);
          if (existsSync(src)) {
            const { copyFileSync } = require("node:fs") as typeof import("node:fs");
            copyFileSync(src, join(destDir, name));
          } else {
            console.error(`  Warning: expected ${src} not found in wasm-pack output`);
          }
        }
        console.log(`\nWASM files installed to ${destDir}`);
      }
      process.exitCode = code ?? 1;
    });
  } else {
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

    const buildArgs = ["build", "-p", "plushie"];
    if (isRelease) buildArgs.push("--release");
    console.log(`Building plushie binary in ${sourcePath}...`);
    const child = spawn("cargo", buildArgs, { cwd: sourcePath, stdio: "inherit" });
    child.on("exit", (code) => {
      if (code === 0) {
        const profile = isRelease ? "release" : "debug";
        const binPath = resolve(sourcePath, "target", profile, "plushie");
        console.log(`\nBinary built at: ${binPath}`);
      }
      process.exitCode = code ?? 1;
    });
  }
}

/** Returns true if the extension build was initiated, false if no native extensions found. */
function handleExtensionBuild(sourcePath: string, configPath: string, release: boolean): boolean {
  const { validateExtensions, generateCargoToml, generateMainRs } =
    require("../extension-build.js") as typeof import("../extension-build.js");

  let config: import("../extension-build.js").ExtensionBuildConfig;
  try {
    const raw = JSON.parse(readFileSync(configPath, "utf-8")) as {
      extensions?: Array<import("../extension.js").ExtensionWidgetConfig>;
      binaryName?: string;
    };
    const extensions = raw.extensions ?? [];
    const nativeExts = extensions.filter((e) => e.rustCrate);
    if (nativeExts.length === 0) {
      return false; // No native extensions -- caller should do stock build
    }
    const buildConfig: Record<string, unknown> = { extensions, sourcePath, release };
    if (raw.binaryName !== undefined) buildConfig["binaryName"] = raw.binaryName;
    config = buildConfig as unknown as import("../extension-build.js").ExtensionBuildConfig;
    validateExtensions(extensions);
  } catch (err) {
    console.error(`Failed to read ${configPath}: ${String(err)}`);
    process.exitCode = 1;
    return true; // Error handled, don't fall through to stock build
  }

  const nativeExts = config.extensions.filter((e) => e.rustCrate);
  console.log(`Building custom binary with ${String(nativeExts.length)} extension(s):`);
  for (const ext of nativeExts) {
    console.log(`  ${ext.type} (${ext.rustCrate})`);
  }

  // Generate workspace
  const buildDir = resolve("node_modules", ".plushie", "build");
  mkdirSync(buildDir, { recursive: true });
  mkdirSync(join(buildDir, "src"), { recursive: true });

  const cargoToml = generateCargoToml(config);
  writeFileSync(join(buildDir, "Cargo.toml"), cargoToml, "utf-8");

  const mainRs = generateMainRs(config.extensions);
  writeFileSync(join(buildDir, "src", "main.rs"), mainRs, "utf-8");

  console.log(`Generated workspace at ${buildDir}`);

  // Build
  const buildArgs = ["build"];
  if (release) buildArgs.push("--release");
  console.log(`\nBuilding${release ? " (release)" : ""}...`);

  const child = spawn("cargo", buildArgs, { cwd: buildDir, stdio: "inherit" });
  child.on("exit", (code) => {
    if (code === 0) {
      const profile = release ? "release" : "debug";
      const binName = config.binaryName ?? "plushie-custom";
      const binPath = resolve(buildDir, "target", profile, binName);
      console.log(`\nCustom binary built at: ${binPath}`);
      console.log(`Binary resolution will find it automatically via plushie.extensions.json.`);
    }
    process.exitCode = code ?? 1;
  });
  return true;
}

// =========================================================================
// Connect
// =========================================================================

async function handleConnect(
  positional: string[],
  flags: string[],
  binaryOverride: string | undefined,
): Promise<void> {
  const addr = positional[0];
  const appFile = positional[1];
  if (!addr) {
    console.error("Usage: plushie connect <address> [app]\n");
    console.error("Address: Unix socket path or host:port");
    console.log(USAGE);
    process.exitCode = 1;
    return;
  }

  const jsonFlag = flags.includes("--json");
  const format = jsonFlag ? ("json" as const) : ("msgpack" as const);

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
        PLUSHIE_SOCKET_ADDRESS: addr,
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
      const hello = await session.connect({ timeout: 10_000 });
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

  // Parse flags from the remaining args (after the command)
  const rest = args.slice(1);
  const flags = rest.filter((a) => a.startsWith("--"));
  const positional = rest.filter((a) => !a.startsWith("--"));
  const jsonFlag = flags.includes("--json");
  const noWatch = flags.includes("--no-watch");
  const binaryIdx = rest.indexOf("--binary");
  const binaryOverride = binaryIdx !== -1 ? rest[binaryIdx + 1] : undefined;

  // Build extra env vars from flags
  const extraEnv: Record<string, string> = {};
  if (jsonFlag) extraEnv["PLUSHIE_FORMAT"] = "json";
  if (binaryOverride !== undefined) extraEnv["PLUSHIE_BINARY_PATH"] = binaryOverride;

  switch (command) {
    case "download":
      await handleDownload(rest);
      break;
    case "build":
      handleBuild(flags);
      break;
    case "connect":
      await handleConnect(positional, flags, binaryOverride);
      break;
    case "script":
      await handleScript(positional, flags, binaryOverride);
      break;
    case "replay":
      await handleReplay(positional, flags, binaryOverride);
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
      const devArgs = noWatch ? [positional[0]] : ["--watch", positional[0]];
      const devChild = spawn(devTsx, devArgs, {
        stdio: "inherit",
        env: { ...process.env, ...extraEnv },
      });
      devChild.on("exit", (code) => {
        process.exitCode = code ?? 1;
      });
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

void main(process.argv);

import { spawn } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve as resolvePath } from "node:path";
import { afterEach, describe, expect, test } from "vitest";

const repoRoot = resolvePath(import.meta.dirname, "..", "..");

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function writeExecutable(path: string, contents: string): void {
  writeFileSync(path, contents, "utf-8");
  chmodSync(path, 0o755);
}

function runCli(args: string[], cwd: string, env: NodeJS.ProcessEnv): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      resolvePath(repoRoot, "node_modules", ".bin", "tsx"),
      [resolvePath(repoRoot, "src", "cli", "index.ts"), ...args],
      {
        cwd,
        env,
        stdio: "ignore",
      },
    );

    child.once("error", reject);
    child.once("exit", (code) => {
      resolve(code ?? 1);
    });
  });
}

describe("plushie build", () => {
  test("reports a failing artifact build even when a later child succeeds", async () => {
    const dir = mkdtempSync(join(tmpdir(), "plushie-cli-build-"));
    tempDirs.push(dir);

    const binDir = join(dir, "bin");
    const projectDir = join(dir, "project");
    const rustDir = join(dir, "plushie-rust");
    const cargoMarker = join(dir, "cargo-ran");
    mkdirSync(join(rustDir, "crates", "plushie-renderer-wasm"), { recursive: true });
    mkdirSync(projectDir, { recursive: true });
    mkdirSync(binDir, { recursive: true });

    writeFileSync(
      join(projectDir, "plushie.extensions.json"),
      JSON.stringify({ artifacts: ["wasm", "bin"], source_path: rustDir }),
      "utf-8",
    );

    writeExecutable(join(binDir, "rustc"), "#!/bin/sh\necho 'rustc 1.92.0 (fake)'\n");
    writeExecutable(join(binDir, "wasm-pack"), "#!/bin/sh\nsleep 0.05\nexit 9\n");
    writeExecutable(
      join(binDir, "cargo"),
      [
        "#!/bin/sh",
        "sleep 0.2",
        ': > "$PLUSHIE_CARGO_MARKER"',
        "mkdir -p target/debug",
        "echo bin > target/debug/plushie-renderer",
      ].join("\n"),
    );

    const code = await runCli(["build"], projectDir, {
      ...process.env,
      PATH: `${binDir}${delimiter}${process.env["PATH"] ?? ""}`,
      PLUSHIE_CARGO_MARKER: cargoMarker,
    });

    expect(code).toBe(9);
    expect(existsSync(cargoMarker)).toBe(true);
  });

  test("builds WASM when the native widget build replaces the stock binary build", async () => {
    const dir = mkdtempSync(join(tmpdir(), "plushie-cli-build-"));
    tempDirs.push(dir);

    const binDir = join(dir, "bin");
    const projectDir = join(dir, "project");
    const rustDir = join(dir, "plushie-rust");
    const widgetDir = join(dir, "widget");
    const cargoMarker = join(dir, "cargo-ran");
    const wasmMarker = join(dir, "wasm-pack-ran");
    mkdirSync(join(rustDir, "crates", "plushie-renderer-wasm"), { recursive: true });
    mkdirSync(projectDir, { recursive: true });
    mkdirSync(widgetDir, { recursive: true });
    mkdirSync(binDir, { recursive: true });

    writeFileSync(
      join(projectDir, "plushie.extensions.json"),
      JSON.stringify({
        artifacts: ["wasm", "bin"],
        source_path: rustDir,
        wasm_dir: "static",
        extensions: [{ type: "example.NativeWidget", rustCrate: widgetDir }],
      }),
      "utf-8",
    );

    writeExecutable(join(binDir, "rustc"), "#!/bin/sh\necho 'rustc 1.92.0 (fake)'\n");
    writeExecutable(
      join(binDir, "wasm-pack"),
      [
        "#!/bin/sh",
        ': > "$PLUSHIE_WASM_MARKER"',
        "mkdir -p pkg",
        "echo js > pkg/plushie_renderer_wasm.js",
        "echo wasm > pkg/plushie_renderer_wasm_bg.wasm",
      ].join("\n"),
    );
    writeExecutable(
      join(binDir, "cargo"),
      [
        "#!/bin/sh",
        'case "$*" in',
        '  *" build -p plushie-renderer"*)',
        '    echo "stock renderer build should not run" >&2',
        "    exit 64",
        "    ;;",
        '  "run --manifest-path "*"-p cargo-plushie "*" -- build --manifest-path "*)',
        '    : > "$PLUSHIE_CARGO_MARKER"',
        "    mkdir -p node_modules/.plushie/renderer-spec/target/plushie-renderer/target/debug",
        "    echo bin > node_modules/.plushie/renderer-spec/target/plushie-renderer/target/debug/plushie-renderer-spec-renderer",
        "    ;;",
        "  *)",
        '    echo "unexpected cargo command: $*" >&2',
        "    exit 65",
        "    ;;",
        "esac",
      ].join("\n"),
    );

    const code = await runCli(["build"], projectDir, {
      ...process.env,
      PATH: `${binDir}${delimiter}${process.env["PATH"] ?? ""}`,
      PLUSHIE_CARGO_MARKER: cargoMarker,
      PLUSHIE_WASM_MARKER: wasmMarker,
    });

    expect(code).toBe(0);
    expect(existsSync(wasmMarker)).toBe(true);
    expect(existsSync(cargoMarker)).toBe(true);
    expect(existsSync(join(projectDir, "static", "plushie_renderer_wasm.js"))).toBe(true);
    expect(existsSync(join(projectDir, "static", "plushie_renderer_wasm_bg.wasm"))).toBe(true);
    expect(existsSync(join(projectDir, "bin", "plushie-renderer"))).toBe(true);
  });

  test("honors configured binary destination for stock source builds", async () => {
    const dir = mkdtempSync(join(tmpdir(), "plushie-cli-build-"));
    tempDirs.push(dir);

    const binDir = join(dir, "bin");
    const projectDir = join(dir, "project");
    const rustDir = join(dir, "plushie-rust");
    const customDest = join(projectDir, "vendor", "renderer");
    mkdirSync(join(rustDir, "target", "debug"), { recursive: true });
    mkdirSync(projectDir, { recursive: true });
    mkdirSync(binDir, { recursive: true });

    writeFileSync(
      join(projectDir, "plushie.extensions.json"),
      JSON.stringify({
        artifacts: ["bin"],
        source_path: rustDir,
        bin_file: "vendor/renderer",
      }),
      "utf-8",
    );

    writeExecutable(join(binDir, "rustc"), "#!/bin/sh\necho 'rustc 1.92.0 (fake)'\n");
    writeExecutable(
      join(binDir, "cargo"),
      [
        "#!/bin/sh",
        'case "$*" in',
        '  *"build -p plushie-renderer"*)',
        "    mkdir -p target/debug",
        "    echo bin > target/debug/plushie-renderer",
        "    ;;",
        "  *)",
        '    echo "unexpected cargo command: $*" >&2',
        "    exit 65",
        "    ;;",
        "esac",
      ].join("\n"),
    );

    const code = await runCli(["build"], projectDir, {
      ...process.env,
      PATH: `${binDir}${delimiter}${process.env["PATH"] ?? ""}`,
    });

    expect(code).toBe(0);
    expect(existsSync(customDest)).toBe(true);
    expect(existsSync(join(projectDir, "bin", "plushie-renderer"))).toBe(false);
  });
});

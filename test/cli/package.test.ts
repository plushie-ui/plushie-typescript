import { spawn } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve as resolvePath } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { PLUSHIE_RUST_VERSION } from "../../src/client/binary.js";

const repoRoot = resolvePath(import.meta.dirname, "..", "..");
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function writeExecutable(path: string, contents = "#!/bin/sh\nexit 0\n"): void {
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

function runCliWithOutput(
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      resolvePath(repoRoot, "node_modules", ".bin", "tsx"),
      [resolvePath(repoRoot, "src", "cli", "index.ts"), ...args],
      {
        cwd,
        env,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf-8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf-8");
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

/**
 * Write a fake `cargo-plushie` stub that records its arguments and exits 0.
 *
 * When called with `--version` it prints `cargo-plushie <version>` so
 * `resolveCargoPlushie` accepts it as a matching installed binary.
 * Otherwise it writes all args to `<binDir>/assemble-args` for assertion.
 */
function writeFakeCargoPlushie(binDir: string, version: string): void {
  const stubPath = join(binDir, "cargo-plushie");
  writeFileSync(
    stubPath,
    [
      "#!/bin/sh",
      `if [ "$1" = "--version" ]; then`,
      `  printf 'cargo-plushie %s\\n' '${version}'`,
      "  exit 0",
      "fi",
      // Write args to a file for assertion
      `printf '%s\\n' "$@" > "${binDir}/assemble-args"`,
      "exit 0",
      "",
    ].join("\n"),
    "utf-8",
  );
  chmodSync(stubPath, 0o755);
}

describe("plushie package", () => {
  test("builds payload dir, writes partial manifest, and shells to cargo-plushie assemble", async () => {
    const dir = mkdtempSync(join(tmpdir(), "plushie-cli-package-"));
    tempDirs.push(dir);

    const projectDir = join(dir, "project");
    const binDir = join(dir, "bin");
    const packageToolDir = join(projectDir, "bin");
    mkdirSync(projectDir, { recursive: true });
    mkdirSync(binDir, { recursive: true });
    mkdirSync(packageToolDir, { recursive: true });

    const host = join(binDir, "host");
    const renderer = join(binDir, "plushie-renderer");
    writeExecutable(host);
    writeExecutable(renderer);
    writeExecutable(join(packageToolDir, "plushie"));
    writeExecutable(join(packageToolDir, "plushie-launcher"));
    writeFakeCargoPlushie(binDir, PLUSHIE_RUST_VERSION);
    writeFileSync(
      join(projectDir, "package.json"),
      JSON.stringify({ name: "package-test", version: "0.2.0" }),
      "utf-8",
    );

    // Unset PLUSHIE_RUST_SOURCE_PATH so resolveCargoPlushie uses the
    // installed cargo-plushie stub on PATH rather than a source checkout.
    const { PLUSHIE_RUST_SOURCE_PATH: _ignored, ...baseEnv } = process.env;
    const result = await runCliWithOutput(
      [
        "package",
        "--app-id",
        "dev.plushie.test",
        "--app-name",
        "Test App",
        "--host-bin",
        host,
        "--renderer-path",
        renderer,
        "--target",
        "linux-x86_64",
      ],
      projectDir,
      { ...baseEnv, PATH: `${binDir}${delimiter}${baseEnv["PATH"] ?? ""}` },
    );

    expect(result.code).toBe(0);

    const outputDir = join(projectDir, "dist");
    const manifestPath = join(outputDir, "plushie-package.toml");
    expect(existsSync(manifestPath)).toBe(true);

    const manifest = readFileSync(manifestPath, "utf-8");
    expect(manifest).toContain('app_id = "dev.plushie.test"');
    expect(manifest).toContain('app_name = "Test App"');
    expect(manifest).toContain('app_version = "0.2.0"');
    expect(manifest).toContain('[renderer]\npath = "bin/plushie-renderer"');
    // host-bin basename is used as the host name when --host-name is not set
    expect(manifest).toContain('command = ["bin/host"]');
    // Partial manifest must not include payload or working_dir
    expect(manifest).not.toContain("[payload]");
    expect(manifest).not.toContain("working_dir");

    // cargo-plushie assemble must have been called with the right args
    const assembleArgs = readFileSync(join(binDir, "assemble-args"), "utf-8");
    expect(assembleArgs).toContain("package");
    expect(assembleArgs).toContain("assemble");
    expect(assembleArgs).toContain("--manifest");
    expect(assembleArgs).toContain(manifestPath);
    expect(assembleArgs).toContain("--payload-dir");
  });

  test("forwards --package-config to cargo-plushie assemble", async () => {
    const dir = mkdtempSync(join(tmpdir(), "plushie-cli-pkg-config-"));
    tempDirs.push(dir);

    const projectDir = join(dir, "project");
    const binDir = join(dir, "bin");
    const packageToolDir = join(projectDir, "bin");
    mkdirSync(projectDir, { recursive: true });
    mkdirSync(binDir, { recursive: true });
    mkdirSync(packageToolDir, { recursive: true });

    const host = join(binDir, "host");
    const renderer = join(binDir, "plushie-renderer");
    const packageConfig = join(projectDir, "my-package.toml");
    writeExecutable(host);
    writeExecutable(renderer);
    writeExecutable(join(packageToolDir, "plushie"));
    writeExecutable(join(packageToolDir, "plushie-launcher"));
    writeFakeCargoPlushie(binDir, PLUSHIE_RUST_VERSION);
    writeFileSync(packageConfig, "# placeholder\n", "utf-8");
    writeFileSync(
      join(projectDir, "package.json"),
      JSON.stringify({ name: "package-test", version: "0.1.0" }),
      "utf-8",
    );

    // Unset PLUSHIE_RUST_SOURCE_PATH so resolveCargoPlushie uses the
    // installed cargo-plushie stub on PATH rather than a source checkout.
    const { PLUSHIE_RUST_SOURCE_PATH: _ignored, ...baseEnv } = process.env;
    const result = await runCliWithOutput(
      [
        "package",
        "--app-id",
        "dev.plushie.test",
        "--host-bin",
        host,
        "--renderer-path",
        renderer,
        "--target",
        "linux-x86_64",
        "--package-config",
        packageConfig,
      ],
      projectDir,
      { ...baseEnv, PATH: `${binDir}${delimiter}${baseEnv["PATH"] ?? ""}` },
    );

    expect(result.code).toBe(0);

    const assembleArgs = readFileSync(join(binDir, "assemble-args"), "utf-8");
    expect(assembleArgs).toContain("--package-config");
    expect(assembleArgs).toContain(packageConfig);
  });

  test("writes package config without requiring package metadata", async () => {
    const dir = mkdtempSync(join(tmpdir(), "plushie-cli-package-config-"));
    tempDirs.push(dir);

    const code = await runCli(["package", "--write-package-config"], dir, process.env);

    expect(code).toBe(0);
    expect(readFileSync(join(dir, "plushie-package.config.toml"), "utf-8")).toContain(
      'command = ["bin/connect"]',
    );
  });
});

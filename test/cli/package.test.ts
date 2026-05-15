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

const repoRoot = resolvePath(import.meta.dirname, "..", "..");
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function writeExecutable(path: string): void {
  writeFileSync(path, "#!/bin/sh\nexit 0\n", "utf-8");
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

describe("plushie package", () => {
  test("prepares a shared-launcher payload from an existing host executable", async () => {
    const dir = mkdtempSync(join(tmpdir(), "plushie-cli-package-"));
    tempDirs.push(dir);

    const projectDir = join(dir, "project");
    const binDir = join(dir, "bin");
    mkdirSync(projectDir, { recursive: true });
    mkdirSync(binDir, { recursive: true });

    const host = join(binDir, "host");
    const renderer = join(binDir, "plushie-renderer");
    const icon = join(binDir, "icon.png");
    writeExecutable(host);
    writeExecutable(renderer);
    writeFileSync(icon, "icon", "utf-8");
    writeFileSync(
      join(projectDir, "plushie-package.config.toml"),
      [
        "config_version = 1",
        "",
        "[start]",
        'working_dir = "app"',
        'command = ["bin/host", "--cli-config"]',
        'forward_env = ["PATH"]',
        "",
      ].join("\n"),
      "utf-8",
    );
    writeFileSync(
      join(projectDir, "package.json"),
      JSON.stringify({ name: "package-test", version: "0.2.0" }),
      "utf-8",
    );

    const code = await runCli(
      [
        "package",
        "--app-id",
        "dev.plushie.test",
        "--app-name",
        "Test App",
        "--host-bin",
        host,
        "--renderer-bin",
        renderer,
        "--icon",
        icon,
        "--package-config",
        join(projectDir, "plushie-package.config.toml"),
        "--target",
        "linux-x86_64",
      ],
      projectDir,
      { ...process.env, PATH: `${binDir}${delimiter}${process.env["PATH"] ?? ""}` },
    );

    expect(code).toBe(0);

    const outputDir = join(projectDir, "dist", "shared-launcher");
    const manifestPath = join(outputDir, "plushie-package.toml");
    expect(existsSync(join(outputDir, "payload.tar.zst"))).toBe(true);
    expect(existsSync(manifestPath)).toBe(true);

    const manifest = readFileSync(manifestPath, "utf-8");
    expect(manifest).toContain('app_id = "dev.plushie.test"');
    expect(manifest).toContain('app_name = "Test App"');
    expect(manifest).toContain('app_version = "0.2.0"');
    expect(manifest).toContain('[renderer]\npath = "bin/plushie-renderer"');
    expect(manifest).toContain('working_dir = "app"');
    expect(manifest).toContain('command = ["bin/host", "--cli-config"]');
    expect(manifest).toContain('forward_env = ["PATH"]');
    expect(manifest).toContain('icon = "assets/icon.png"');
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

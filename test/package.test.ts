import { spawnSync } from "node:child_process";
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
import { join, resolve as resolvePath } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  installedBinaryName,
  installedLauncherName,
  installedToolName,
  PLUSHIE_RUST_VERSION,
} from "../src/client/binary.js";
import {
  manifestForPayload,
  normalizePackageTarget,
  prepareNodePackagePayload,
  readPackageStartConfig,
  renderPackageManifest,
  renderPackageStartConfig,
  resolvePackageRenderer,
  writePackageStartConfig,
} from "../src/package.js";

const repoRoot = resolvePath(import.meta.dirname, "..");
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "plushie-package-"));
  tempDirs.push(dir);
  return dir;
}

function writeExecutable(path: string, contents = "#!/bin/sh\nexit 0\n"): void {
  writeFileSync(path, contents, "utf-8");
  chmodSync(path, 0o755);
}

function writePackageTools(dir: string): void {
  const binDir = join(dir, "bin");
  mkdirSync(binDir, { recursive: true });
  writeExecutable(join(binDir, installedToolName()));
  writeExecutable(join(binDir, installedLauncherName()));
}

function sdkVersion(): string {
  const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8")) as {
    version: string;
  };
  return pkg.version;
}

describe("normalizePackageTarget", () => {
  test("normalizes supported package targets", () => {
    expect(normalizePackageTarget("Linux", "x64")).toBe("linux-x86_64");
    expect(normalizePackageTarget("Darwin", "arm64")).toBe("darwin-aarch64");
    expect(normalizePackageTarget("win32", "AMD64")).toBe("windows-x86_64");
  });

  test("rejects unknown target parts", () => {
    expect(() => normalizePackageTarget("plan9", "x64")).toThrow(/unsupported package OS/);
    expect(() => normalizePackageTarget("linux", "riscv64")).toThrow(
      /unsupported package architecture/,
    );
  });
});

describe("package manifest", () => {
  test("records payload identity and SDK metadata", () => {
    const dir = tempDir();
    const archive = join(dir, "payload.tar.zst");
    writeFileSync(archive, "payload");

    const manifest = manifestForPayload({
      appId: "dev.plushie.test",
      appName: "Test App",
      appVersion: "0.1.0",
      target: "linux-x86_64",
      rendererKind: "custom",
      rendererPath: "bin/plushie-renderer",
      startCommand: ["bin/host", "--flag"],
      platformIcon: "assets/icon.png",
      payloadArchive: archive,
    });

    expect(manifest.payloadArchive).toBe("payload.tar.zst");
    expect(manifest.payloadSize).toBe(Buffer.byteLength("payload"));
    expect(manifest.payloadHash).toMatch(/^[a-f0-9]{64}$/);

    const toml = renderPackageManifest(manifest);
    expect(toml).toContain('host_sdk = "typescript"');
    expect(toml).toContain(`host_sdk_version = "${sdkVersion()}"`);
    expect(toml).toContain(`plushie_rust_version = "${PLUSHIE_RUST_VERSION}"`);
    expect(toml).toContain("protocol_version = 1");
    expect(toml).toContain("[start]");
    expect(toml).toContain('working_dir = "."');
    expect(toml).toContain('command = ["bin/host", "--flag"]');
    expect(toml).toContain(
      'forward_env = ["PATH", "HOME", "LANG", "LC_ALL", "XDG_RUNTIME_DIR", "WAYLAND_DISPLAY", "DISPLAY"]',
    );
    expect(toml).toContain('[renderer]\npath = "bin/plushie-renderer"');
    expect(toml).toContain('kind = "custom"');
    expect(toml).toContain("[platform]");
    expect(toml).toContain('icon = "assets/icon.png"');
  });

  test("omits [platform] section when no icon is set", () => {
    const dir = tempDir();
    const archive = join(dir, "payload.tar.zst");
    writeFileSync(archive, "payload");

    const manifest = manifestForPayload({
      appId: "dev.plushie.test",
      appName: "Test App",
      appVersion: "0.1.0",
      target: "linux-x86_64",
      rendererKind: "custom",
      rendererPath: "bin/plushie-renderer",
      startCommand: ["bin/host"],
      payloadArchive: archive,
    });

    const toml = renderPackageManifest(manifest);
    expect(toml).not.toContain("[platform]");
    expect(toml).not.toContain("icon =");
  });
});

describe("package start config", () => {
  test("reads committed source package config", () => {
    const dir = tempDir();
    const configPath = join(dir, "plushie-package.config.toml");
    writeFileSync(
      configPath,
      [
        "config_version = 1",
        "",
        "[start]",
        'working_dir = "app"',
        'command = ["bin/host", "--mode", "standalone"]',
        'forward_env = ["PATH", "HOME"]',
        "",
      ].join("\n"),
      "utf-8",
    );

    expect(readPackageStartConfig(configPath)).toEqual({
      workingDir: "app",
      command: ["bin/host", "--mode", "standalone"],
      forwardEnv: ["PATH", "HOME"],
    });
  });

  test("reads multiline TOML arrays", () => {
    const dir = tempDir();
    const configPath = join(dir, "plushie-package.config.toml");
    writeFileSync(
      configPath,
      [
        "config_version = 1",
        "",
        "[start]",
        'working_dir = "app"',
        "command = [",
        '  "bin/host",',
        '  "--mode",',
        '  "standalone",',
        "]",
        "forward_env = [",
        '  "PATH",',
        '  "HOME",',
        "]",
        "",
      ].join("\n"),
      "utf-8",
    );

    expect(readPackageStartConfig(configPath)).toEqual({
      workingDir: "app",
      command: ["bin/host", "--mode", "standalone"],
      forwardEnv: ["PATH", "HOME"],
    });
  });

  test("reads TOML strings that end with a bracket", () => {
    const dir = tempDir();
    const configPath = join(dir, "plushie-package.config.toml");
    writeFileSync(
      configPath,
      [
        "config_version = 1",
        "",
        "[start]",
        'working_dir = "host/[prod]"',
        'command = ["bin/host"]',
        'forward_env = ["PATH"]',
        "",
      ].join("\n"),
      "utf-8",
    );

    expect(readPackageStartConfig(configPath)?.workingDir).toBe("host/[prod]");
  });

  test("allows an empty forwarded environment", () => {
    const dir = tempDir();
    const configPath = join(dir, "plushie-package.config.toml");
    writeFileSync(
      configPath,
      [
        "config_version = 1",
        "",
        "[start]",
        'working_dir = "."',
        'command = ["bin/host"]',
        "forward_env = []",
        "",
      ].join("\n"),
      "utf-8",
    );

    expect(readPackageStartConfig(configPath)?.forwardEnv).toEqual([]);
  });

  test("renders package config template with real start values", () => {
    const text = renderPackageStartConfig();

    expect(text).toContain("config_version = 1");
    expect(text).toContain('working_dir = "."');
    expect(text).toContain('command = ["bin/connect"]');
    expect(text).toContain('"WAYLAND_DISPLAY"');
  });

  test("writes package config template", () => {
    const dir = tempDir();
    const configPath = join(dir, "plushie-package.config.toml");

    writePackageStartConfig(configPath);

    expect(readFileSync(configPath, "utf-8")).toContain('command = ["bin/connect"]');
  });

  test("keeps current behavior when source package config is missing", () => {
    const dir = tempDir();

    expect(readPackageStartConfig(join(dir, "missing.toml"))).toBeUndefined();
  });

  test.each([
    ["absolute working_dir", 'working_dir = "/app"', /working_dir must be relative/],
    ["parent working_dir", 'working_dir = "../app"', /working_dir must not contain parent/],
    ["absolute command path", 'command = ["/bin/host"]', /command\[0\] must be relative/],
    ["parent command path", 'command = ["bin/../host"]', /command\[0\] must not contain parent/],
    ["empty command", "command = []", /command must not be empty/],
    ["empty command arg", 'command = ["bin/host", ""]', /command\[1\] must not be empty/],
    ["env with comma", 'forward_env = ["PATH,HOME"]', /invalid .*forward_env name/],
    ["env with equals", 'forward_env = ["PATH=HOME"]', /invalid .*forward_env name/],
    ["non-string command arg", 'command = ["bin/host", 1]', /expected string array value/],
    ["non-string env", 'forward_env = ["PATH", 1]', /expected string array value/],
    [
      "reserved binary env",
      'forward_env = ["PLUSHIE_BINARY_PATH"]',
      /cannot include reserved name/,
    ],
    [
      "reserved package env",
      'forward_env = ["PLUSHIE_PACKAGE_DIR"]',
      /cannot include reserved name/,
    ],
    [
      "reserved package readiness env",
      'forward_env = ["PLUSHIE_PACKAGE_READY_FILE"]',
      /cannot include reserved name/,
    ],
    ["reserved socket env", 'forward_env = ["PLUSHIE_SOCKET"]', /cannot include reserved name/],
    ["reserved token env", 'forward_env = ["PLUSHIE_TOKEN"]', /cannot include reserved name/],
    [
      "reserved transport env",
      'forward_env = ["PLUSHIE_TRANSPORT"]',
      /cannot include reserved name/,
    ],
    [
      "reserved rust source path env",
      'forward_env = ["PLUSHIE_RUST_SOURCE_PATH"]',
      /cannot include reserved name/,
    ],
    [
      "reserved release base url env",
      'forward_env = ["PLUSHIE_RELEASE_BASE_URL"]',
      /cannot include reserved name/,
    ],
    [
      "reserved cache dir env",
      'forward_env = ["PLUSHIE_CACHE_DIR"]',
      /cannot include reserved name/,
    ],
    [
      "reserved launcher path env",
      'forward_env = ["PLUSHIE_LAUNCHER_PATH"]',
      /cannot include reserved name/,
    ],
    [
      "reserved tool source kind env",
      'forward_env = ["PLUSHIE_TOOL_SOURCE_KIND"]',
      /cannot include reserved name/,
    ],
    ["reserved format env", 'forward_env = ["PLUSHIE_FORMAT"]', /cannot include reserved name/],
    [
      "reserved no catch unwind env",
      'forward_env = ["PLUSHIE_NO_CATCH_UNWIND"]',
      /cannot include reserved name/,
    ],
  ])("rejects invalid source package config: %s", (_name, replacement, error) => {
    const dir = tempDir();
    const configPath = join(dir, "plushie-package.config.toml");
    const workingDir = 'working_dir = "."';
    const command = 'command = ["bin/host"]';
    const forwardEnv = 'forward_env = ["PATH"]';
    writeFileSync(
      configPath,
      [
        "config_version = 1",
        "",
        "[start]",
        replacement.startsWith("working_dir") ? replacement : workingDir,
        replacement.startsWith("command") ? replacement : command,
        replacement.startsWith("forward_env") ? replacement : forwardEnv,
        "",
      ].join("\n"),
      "utf-8",
    );

    expect(() => readPackageStartConfig(configPath)).toThrow(error);
  });
});

describe("prepareNodePackagePayload", () => {
  test("copies the host and renderer into a shared-launcher payload", () => {
    const dir = tempDir();
    const outputDir = join(dir, "dist", "shared-launcher");
    const host = join(dir, "host");
    const renderer = join(dir, "plushie-renderer");
    const icon = join(dir, "icon.png");
    writeExecutable(host);
    writeExecutable(renderer);
    writeFileSync(icon, "icon");

    const result = prepareNodePackagePayload({
      appId: "dev.plushie.test",
      appName: "Test App",
      appVersion: "0.1.0",
      hostBin: host,
      hostName: "test-host",
      outputDir,
      target: "linux-x86_64",
      renderer: {
        kind: "stock",
        sourcePath: renderer,
        payloadPath: "bin/plushie-renderer",
      },
      icon,
    });

    expect(existsSync(result.payloadArchivePath)).toBe(true);
    expect(existsSync(result.manifestPath)).toBe(true);
    expect(existsSync(join(outputDir, "payload-root"))).toBe(false);

    const manifest = readFileSync(result.manifestPath, "utf-8");
    expect(manifest).toContain('app_id = "dev.plushie.test"');
    expect(manifest).toContain('[renderer]\npath = "bin/plushie-renderer"');
    expect(manifest).toContain('command = ["bin/test-host"]');
    expect(manifest).toContain('icon = "assets/icon.png"');

    const list = spawnSync("tar", ["--zstd", "-tf", result.payloadArchivePath], {
      encoding: "utf-8",
    });
    expect(list.status).toBe(0);
    expect(list.stdout).toContain("./bin/test-host");
    expect(list.stdout).toContain("./bin/plushie-renderer");
    expect(list.stdout).toContain("./assets/icon.png");
  });

  test("applies committed source package config to the shared-launcher manifest", () => {
    const dir = tempDir();
    const outputDir = join(dir, "dist", "shared-launcher");
    const host = join(dir, "host");
    const renderer = join(dir, "plushie-renderer");
    writeExecutable(host);
    writeExecutable(renderer);
    writeFileSync(
      join(dir, "plushie-package.config.toml"),
      [
        "config_version = 1",
        "",
        "[start]",
        'working_dir = "app"',
        'command = ["bin/test-host", "--standalone"]',
        'forward_env = ["PATH"]',
        "",
      ].join("\n"),
      "utf-8",
    );

    const result = prepareNodePackagePayload({
      appId: "dev.plushie.test",
      appVersion: "0.1.0",
      hostBin: host,
      hostName: "test-host",
      outputDir,
      target: "linux-x86_64",
      renderer: {
        kind: "stock",
        sourcePath: renderer,
        payloadPath: "bin/plushie-renderer",
      },
      packageConfig: join(dir, "plushie-package.config.toml"),
    });

    const manifest = readFileSync(result.manifestPath, "utf-8");
    expect(manifest).toContain('working_dir = "app"');
    expect(manifest).toContain('command = ["bin/test-host", "--standalone"]');
    expect(manifest).toContain('forward_env = ["PATH"]');
  });
});

describe("resolvePackageRenderer", () => {
  test("records explicit renderer paths as local paths", () => {
    const dir = tempDir();
    const oldCwd = process.cwd();
    const renderer = join(dir, "plushie-renderer");
    writeExecutable(renderer);
    writePackageTools(dir);

    try {
      process.chdir(dir);
      const result = resolvePackageRenderer({
        rendererPath: renderer,
        env: {},
      });

      expect(result.sourcePath).toBe(renderer);
    } finally {
      process.chdir(oldCwd);
    }
  });

  test("syncs managed native tools from source for stock packages", () => {
    const dir = tempDir();
    const oldCwd = process.cwd();
    const source = join(dir, "plushie-rust");
    const renderer = join(dir, "bin", installedBinaryName());
    const binDir = join(dir, "bin");
    mkdirSync(source, { recursive: true });
    mkdirSync(binDir);
    writeFileSync(join(source, "Cargo.toml"), "[workspace]\n", "utf-8");
    writeExecutable(
      join(binDir, "cargo"),
      [
        "#!/bin/sh",
        `printf renderer > bin/${installedBinaryName()}`,
        `cat > bin/${installedToolName()} <<'EOF'`,
        "#!/bin/sh",
        "exit 0",
        "EOF",
        `chmod +x bin/${installedToolName()}`,
        `printf launcher > bin/${installedLauncherName()}`,
        "",
      ].join("\n"),
    );
    writePackageTools(dir);

    const oldPath = process.env["PATH"];
    process.env["PATH"] = `${binDir}:${oldPath ?? ""}`;

    let result: ReturnType<typeof resolvePackageRenderer> | undefined;
    try {
      process.chdir(dir);
      result = resolvePackageRenderer({
        env: { PLUSHIE_RUST_SOURCE_PATH: source },
        log: () => {},
      });
    } finally {
      process.chdir(oldCwd);
      process.env["PATH"] = oldPath;
    }

    expect(result?.sourcePath).toBe(renderer);
  });

  test("syncs managed native tools for stock packages", () => {
    const dir = tempDir();
    const binDir = join(dir, "bin");
    mkdirSync(binDir);
    writeExecutable(
      join(binDir, installedToolName()),
      [
        "#!/bin/sh",
        "mkdir -p bin",
        `printf renderer > bin/${process.platform === "win32" ? "plushie-renderer.exe" : "plushie-renderer"}`,
        `printf launcher > bin/${installedLauncherName()}`,
        "exit 0",
        "",
      ].join("\n"),
    );

    const oldCwd = process.cwd();
    try {
      process.chdir(dir);
      const result = resolvePackageRenderer({
        env: {},
        log: () => {},
      });

      expect(result.sourcePath).toBe(join(dir, "bin", "plushie-renderer"));
    } finally {
      process.chdir(oldCwd);
    }
  });

  test("rejects custom renderer packaging without an explicit binary path", () => {
    expect(() =>
      resolvePackageRenderer({
        rendererKind: "custom",
        env: {},
      }),
    ).toThrow(/custom renderer packaging requires/);
  });

  test("allows custom renderer packaging with an explicit binary path", () => {
    const dir = tempDir();
    const oldCwd = process.cwd();
    const renderer = join(dir, "custom-renderer");
    writeExecutable(renderer);
    writePackageTools(dir);

    try {
      process.chdir(dir);
      const result = resolvePackageRenderer({
        rendererKind: "custom",
        rendererPath: renderer,
        env: {},
      });

      expect(result.kind).toBe("custom");
      expect(result.sourcePath).toBe(renderer);
    } finally {
      process.chdir(oldCwd);
    }
  });

  test("requires managed package tools with an explicit renderer path", () => {
    const dir = tempDir();
    const oldCwd = process.cwd();
    const renderer = join(dir, "custom-renderer");
    writeExecutable(renderer);

    try {
      process.chdir(dir);
      expect(() =>
        resolvePackageRenderer({
          rendererKind: "custom",
          rendererPath: renderer,
          env: {},
        }),
      ).toThrow(/managed Plushie tool set/);
    } finally {
      process.chdir(oldCwd);
    }
  });
});

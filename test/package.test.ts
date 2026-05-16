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
  normalizePackageTarget,
  prepareNodePackagePayload,
  renderPackageStartConfig,
  renderPartialManifest,
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

describe("partial manifest", () => {
  test("records SDK metadata and start command", () => {
    const manifest = renderPartialManifest({
      appId: "dev.plushie.test",
      appName: "Test App",
      appVersion: "0.1.0",
      target: "linux-x86_64",
      renderer: { kind: "stock", path: "bin/plushie-renderer" },
      startCommand: ["bin/host"],
    });

    expect(manifest).toContain('app_id = "dev.plushie.test"');
    expect(manifest).toContain('app_name = "Test App"');
    expect(manifest).toContain('app_version = "0.1.0"');
    expect(manifest).toContain('target = "linux-x86_64"');
    expect(manifest).toContain('host_sdk = "typescript"');
    expect(manifest).toContain(`host_sdk_version = "${sdkVersion()}"`);
    expect(manifest).toContain(`plushie_rust_version = "${PLUSHIE_RUST_VERSION}"`);
    expect(manifest).toContain("protocol_version = 1");
    expect(manifest).toContain("[start]");
    expect(manifest).toContain('command = ["bin/host"]');
    expect(manifest).toContain("[renderer]");
    expect(manifest).toContain('path = "bin/plushie-renderer"');
    expect(manifest).toContain('kind = "stock"');
  });

  test("omits app_name when not provided", () => {
    const manifest = renderPartialManifest({
      appId: "dev.plushie.test",
      appVersion: "0.1.0",
      target: "linux-x86_64",
      renderer: { kind: "stock", path: "bin/plushie-renderer" },
      startCommand: ["bin/host"],
    });

    expect(manifest).not.toContain("app_name");
  });

  test("emits custom renderer kind", () => {
    const manifest = renderPartialManifest({
      appId: "dev.plushie.test",
      appVersion: "0.1.0",
      target: "linux-x86_64",
      renderer: { kind: "custom", path: "bin/plushie-renderer" },
      startCommand: ["bin/host"],
    });

    expect(manifest).toContain('kind = "custom"');
  });

  test("does not include payload, working_dir, forward_env, or platform sections", () => {
    const manifest = renderPartialManifest({
      appId: "dev.plushie.test",
      appVersion: "0.1.0",
      target: "linux-x86_64",
      renderer: { kind: "stock", path: "bin/plushie-renderer" },
      startCommand: ["bin/host"],
    });

    expect(manifest).not.toContain("[payload]");
    expect(manifest).not.toContain("working_dir");
    expect(manifest).not.toContain("forward_env");
    expect(manifest).not.toContain("[platform]");
  });
});

describe("package start config template", () => {
  test("renders package config template", () => {
    const text = renderPackageStartConfig();

    expect(text).toContain("config_version = 1");
    expect(text).toContain('command = ["bin/connect"]');
    expect(text).toContain("# [assets]");
    expect(text).toContain('# dir = "package_assets"');
    expect(text).toContain("# [platform]");
    expect(text).toContain("# publisher");
    expect(text).toContain("# bundle_id");
    expect(text).toContain("# [platform.macos]");
    expect(text).toContain("# bundle_version");
    expect(text).toContain("# [platform.windows]");
    expect(text).toContain("# install_scope");
  });

  test("writes package config template", () => {
    const dir = tempDir();
    const configPath = join(dir, "plushie-package.config.toml");

    writePackageStartConfig(configPath);

    expect(readFileSync(configPath, "utf-8")).toContain('command = ["bin/connect"]');
  });
});

describe("prepareNodePackagePayload", () => {
  test("copies host and renderer into payload dir and writes partial manifest", () => {
    const dir = tempDir();
    const outputDir = join(dir, "dist");
    const host = join(dir, "host");
    const renderer = join(dir, "plushie-renderer");
    writeExecutable(host);
    writeExecutable(renderer);

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
    });

    expect(existsSync(result.payloadDir)).toBe(true);
    expect(existsSync(join(result.payloadDir, "bin", "test-host"))).toBe(true);
    expect(existsSync(join(result.payloadDir, "bin", "plushie-renderer"))).toBe(true);
    expect(existsSync(result.manifestPath)).toBe(true);

    const manifest = readFileSync(result.manifestPath, "utf-8");
    expect(manifest).toContain('app_id = "dev.plushie.test"');
    expect(manifest).toContain('app_name = "Test App"');
    expect(manifest).toContain('[renderer]\npath = "bin/plushie-renderer"');
    expect(manifest).toContain('command = ["bin/test-host"]');
    expect(manifest).not.toContain("[payload]");
    expect(manifest).not.toContain("working_dir");
  });

  test("sets start command to bin/<hostName> by default", () => {
    const dir = tempDir();
    const host = join(dir, "host");
    const renderer = join(dir, "plushie-renderer");
    writeExecutable(host);
    writeExecutable(renderer);

    const result = prepareNodePackagePayload({
      appId: "dev.plushie.test",
      appVersion: "0.1.0",
      hostBin: host,
      hostName: "my-app-host",
      outputDir: join(dir, "dist"),
      target: "linux-x86_64",
      renderer: {
        kind: "stock",
        sourcePath: renderer,
        payloadPath: "bin/plushie-renderer",
      },
    });

    expect(result.manifest.startCommand).toEqual(["bin/my-app-host"]);
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

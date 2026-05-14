import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve as resolvePath } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { PLUSHIE_RUST_VERSION } from "../src/client/binary.js";
import {
  manifestForPayload,
  normalizePackageTarget,
  prepareNodePackagePayload,
  renderPackageManifest,
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
      rendererSource: "local-build",
      rendererPath: "bin/plushie-renderer",
      hostCommand: ["bin/host", "--flag"],
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
    expect(toml).toContain('renderer_path = "bin/plushie-renderer"');
    expect(toml).toContain('host_command = ["bin/host", "--flag"]');
    expect(toml).toContain('kind = "custom"');
    expect(toml).toContain('source = "local-build"');
  });
});

describe("prepareNodePackagePayload", () => {
  test("copies the host and renderer into a shared-launcher payload", () => {
    const dir = tempDir();
    const outputDir = join(dir, "dist", "shared-launcher");
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
        source: "local-resolve",
        sourcePath: renderer,
        payloadPath: "bin/plushie-renderer",
      },
    });

    expect(existsSync(result.payloadArchivePath)).toBe(true);
    expect(existsSync(result.manifestPath)).toBe(true);
    expect(existsSync(join(outputDir, "payload-root"))).toBe(false);

    const manifest = readFileSync(result.manifestPath, "utf-8");
    expect(manifest).toContain('app_id = "dev.plushie.test"');
    expect(manifest).toContain('renderer_path = "bin/plushie-renderer"');
    expect(manifest).toContain('host_command = ["bin/test-host"]');

    const list = spawnSync("tar", ["--zstd", "-tf", result.payloadArchivePath], {
      encoding: "utf-8",
    });
    expect(list.status).toBe(0);
    expect(list.stdout).toContain("./bin/test-host");
    expect(list.stdout).toContain("./bin/plushie-renderer");
  });
});

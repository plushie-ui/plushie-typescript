import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer, type Server, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  downloadFileWithChecksum,
  downloadReleaseBinary,
  platformBinaryName,
} from "../../src/client/binary.js";

const tempDirs: string[] = [];
const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((err) => {
            if (err) reject(err);
            else resolve();
          });
        }),
    ),
  );
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("platformBinaryName", () => {
  test("returns a string with platform and arch", () => {
    const name = platformBinaryName();
    expect(name).toMatch(/^plushie-renderer-(darwin|linux|windows)-(x86_64|aarch64)/);
  });

  test("does not end with .exe on non-windows", () => {
    // This test is platform-dependent; on Linux/macOS it should not have .exe
    if (process.platform !== "win32") {
      expect(platformBinaryName()).not.toContain(".exe");
    }
  });
});

describe("downloadBinary", () => {
  test("retries transient failures and installs a verified executable binary", async () => {
    const dir = tempDir();
    const destPath = join(dir, "plushie-renderer-test");
    const body = Buffer.from("renderer");
    const hash = sha256(body);
    let binaryRequests = 0;

    const origin = await serve((path, res) => {
      if (path === "/release/v0.0.0/plushie-renderer-test") {
        binaryRequests += 1;
        if (binaryRequests === 1) {
          res.statusCode = 503;
          res.end("try again");
        } else {
          res.end(body);
        }
        return;
      }
      if (path === "/release/v0.0.0/plushie-renderer-test.sha256") {
        res.end(`${hash}  plushie-renderer-test\n`);
        return;
      }
      res.statusCode = 404;
      res.end();
    });

    await downloadReleaseBinary({
      binaryName: "plushie-renderer-test",
      destPath,
      releaseBaseUrl: `${origin}/release`,
      version: "0.0.0",
      force: true,
      retryDelayMs: 1,
    });

    expect(binaryRequests).toBe(2);
    expect(readFileSync(destPath)).toEqual(body);
    if (process.platform !== "win32") {
      expect(statSync(destPath).mode & 0o111).not.toBe(0);
    }
  });

  test("rejects checksum mismatches without replacing the current binary", async () => {
    const dir = tempDir();
    const destPath = join(dir, "plushie-renderer-test");
    const body = Buffer.from("renderer");
    const staleBody = "stale renderer";
    const expectedHash = sha256(Buffer.from("different"));
    writeFileSync(destPath, staleBody);

    const origin = await serve((path, res) => {
      if (path === "/release/v0.0.0/plushie-renderer-test") {
        res.end(body);
        return;
      }
      if (path === "/release/v0.0.0/plushie-renderer-test.sha256") {
        res.end(`${expectedHash}  plushie-renderer-test\n`);
        return;
      }
      res.statusCode = 404;
      res.end();
    });

    await expect(
      downloadReleaseBinary({
        binaryName: "plushie-renderer-test",
        destPath,
        releaseBaseUrl: `${origin}/release`,
        version: "0.0.0",
        force: true,
        retryDelayMs: 1,
      }),
    ).rejects.toThrow(/SHA256 mismatch/);

    expect(readFileSync(destPath, "utf-8")).toBe(staleBody);
  });

  test("does not leave the final file after a partial download fails", async () => {
    const dir = tempDir();
    const destPath = join(dir, "renderer.tar.gz");

    const origin = await serve((path, res) => {
      if (path === "/renderer.tar.gz") {
        res.writeHead(200, { "Content-Length": "20" });
        res.write("partial");
        res.destroy();
        return;
      }
      res.statusCode = 404;
      res.end();
    });

    await expect(
      downloadFileWithChecksum(`${origin}/renderer.tar.gz`, destPath, {
        attempts: 1,
        retryDelayMs: 1,
      }),
    ).rejects.toThrow();

    expect(existsSync(destPath)).toBe(false);
  });

  test("rejects non-local HTTP download URLs", async () => {
    const dir = tempDir();
    const destPath = join(dir, "renderer.tar.gz");

    await expect(
      downloadFileWithChecksum("http://example.com/renderer.tar.gz", destPath, {
        retryDelayMs: 1,
      }),
    ).rejects.toThrow(/Refusing non-local HTTP/);

    expect(existsSync(destPath)).toBe(false);
  });

  test("does not retry permanent HTTP failures", async () => {
    const dir = tempDir();
    const destPath = join(dir, "renderer.tar.gz");
    let requests = 0;

    const origin = await serve((path, res) => {
      if (path === "/renderer.tar.gz") {
        requests += 1;
      }
      res.statusCode = 404;
      res.end();
    });

    await expect(
      downloadFileWithChecksum(`${origin}/renderer.tar.gz`, destPath, {
        retryDelayMs: 1,
      }),
    ).rejects.toThrow(/HTTP 404/);

    expect(requests).toBe(1);
    expect(existsSync(destPath)).toBe(false);
  });

  test("rejects missing checksum files without installing the binary", async () => {
    const dir = tempDir();
    const destPath = join(dir, "renderer.tar.gz");
    let checksumRequests = 0;

    const origin = await serve((path, res) => {
      if (path === "/renderer.tar.gz") {
        res.end("renderer");
        return;
      }
      if (path === "/renderer.tar.gz.sha256") {
        checksumRequests += 1;
      }
      res.statusCode = 404;
      res.end();
    });

    await expect(
      downloadFileWithChecksum(`${origin}/renderer.tar.gz`, destPath, {
        retryDelayMs: 1,
      }),
    ).rejects.toThrow(/HTTP 404/);

    expect(checksumRequests).toBe(1);
    expect(existsSync(destPath)).toBe(false);
  });

  test("rejects invalid checksum files without installing the binary", async () => {
    const dir = tempDir();
    const destPath = join(dir, "renderer.tar.gz");

    const origin = await serve((path, res) => {
      if (path === "/renderer.tar.gz") {
        res.end("renderer");
        return;
      }
      if (path === "/renderer.tar.gz.sha256") {
        res.end("not a checksum\n");
        return;
      }
      res.statusCode = 404;
      res.end();
    });

    await expect(
      downloadFileWithChecksum(`${origin}/renderer.tar.gz`, destPath, {
        retryDelayMs: 1,
      }),
    ).rejects.toThrow(/Invalid SHA256 checksum/);

    expect(existsSync(destPath)).toBe(false);
  });

  test("downloads a verified file atomically", async () => {
    const dir = tempDir();
    const destPath = join(dir, "renderer.tar.gz");
    const body = Buffer.from("wasm tarball");
    const hash = sha256(body);

    const origin = await serve((path, res) => {
      if (path === "/renderer.tar.gz") {
        res.end(body);
        return;
      }
      if (path === "/renderer.tar.gz.sha256") {
        res.end(`${hash}  renderer.tar.gz\n`);
        return;
      }
      res.statusCode = 404;
      res.end();
    });

    await downloadFileWithChecksum(`${origin}/renderer.tar.gz`, destPath, {
      retryDelayMs: 1,
    });

    expect(readFileSync(destPath)).toEqual(body);
  });
});

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "plushie-binary-"));
  tempDirs.push(dir);
  return dir;
}

function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function serve(handler: (path: string, res: ServerResponse) => void): Promise<string> {
  const server = createServer((req, res) => {
    handler(req.url ?? "/", res);
  });
  servers.push(server);
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address && typeof address === "object") {
        resolve(`http://127.0.0.1:${String(address.port)}`);
      } else {
        reject(new Error("Server did not bind to a TCP port"));
      }
    });
  });
}

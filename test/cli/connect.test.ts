import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve as resolvePath } from "node:path";
import { afterEach, describe, expect, test } from "vitest";

const repoRoot = resolvePath(import.meta.dirname, "..", "..");
const tsxBin = resolvePath(repoRoot, "node_modules", ".bin", "tsx");
const cliEntry = resolvePath(repoRoot, "src", "cli", "index.ts");

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "plushie-cli-connect-"));
  tempDirs.push(dir);
  return dir;
}

interface SpawnResult {
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * Run the CLI and wait for it to exit. Optionally write to stdin.
 * When stdinData is undefined, stdin is closed immediately.
 */
function runCli(args: string[], env: NodeJS.ProcessEnv, stdinData?: string): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(tsxBin, [cliEntry, ...args], {
      cwd: makeTempDir(),
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

    if (stdinData !== undefined) {
      child.stdin.write(stdinData);
    }
    child.stdin.end();

    child.once("error", reject);
    child.once("exit", (code) => {
      resolve({
        code: code ?? 1,
        stdout: Buffer.concat(stdoutChunks).toString("utf-8"),
        stderr: Buffer.concat(stderrChunks).toString("utf-8"),
      });
    });
  });
}

/**
 * Spawn the CLI and kill it as soon as a given string appears in stdout or
 * stderr. Returns what was collected up to that point along with the partial
 * output flag. Used for tests where we want to verify that a command gets
 * past early error checks without waiting for the full connection timeout.
 */
function runCliUntilOutput(
  args: string[],
  env: NodeJS.ProcessEnv,
  trigger: string,
  stdinData?: string,
): Promise<{ stdout: string; stderr: string; triggered: boolean }> {
  return new Promise((resolve, reject) => {
    const child = spawn(tsxBin, [cliEntry, ...args], {
      cwd: makeTempDir(),
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let triggered = false;

    const check = (): void => {
      const out = Buffer.concat(stdoutChunks).toString("utf-8");
      const err = Buffer.concat(stderrChunks).toString("utf-8");
      if (!triggered && (out.includes(trigger) || err.includes(trigger))) {
        triggered = true;
        child.kill("SIGTERM");
        resolve({ stdout: out, stderr: err, triggered: true });
      }
    };

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk);
      check();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk);
      check();
    });

    if (stdinData !== undefined) {
      child.stdin.write(stdinData);
    }
    child.stdin.end();

    child.once("error", reject);
    child.once("exit", () => {
      if (!triggered) {
        resolve({
          stdout: Buffer.concat(stdoutChunks).toString("utf-8"),
          stderr: Buffer.concat(stderrChunks).toString("utf-8"),
          triggered: false,
        });
      }
    });
  });
}

describe("plushie connect: address resolution", () => {
  test("errors when no positional and no PLUSHIE_SOCKET", async () => {
    // Delete PLUSHIE_SOCKET from the env; also close stdin immediately (no token needed for this check).
    const env = { ...process.env };
    delete env["PLUSHIE_SOCKET"];
    delete env["PLUSHIE_TOKEN"];
    const result = await runCli(["connect"], env);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain(
      "renderer-parent connect requires an address: pass <addr> or set PLUSHIE_SOCKET",
    );
  });

  test("accepts address from PLUSHIE_SOCKET when no positional is given", async () => {
    // When PLUSHIE_SOCKET is set and PLUSHIE_TOKEN is set, the command should
    // proceed to the connection attempt ("Connecting to...") rather than
    // printing the address-resolution error.
    const env = {
      ...process.env,
      PLUSHIE_SOCKET: "/tmp/plushie-no-exist.sock",
      PLUSHIE_TOKEN: "tok",
    };
    const result = await runCliUntilOutput(["connect"], env, "Connecting to");
    expect(result.triggered).toBe(true);
    expect(result.stdout + result.stderr).not.toContain(
      "renderer-parent connect requires an address",
    );
  });

  test("positional address takes precedence over PLUSHIE_SOCKET", async () => {
    const env = {
      ...process.env,
      PLUSHIE_SOCKET: "/tmp/env-socket.sock",
      PLUSHIE_TOKEN: "tok",
    };
    const result = await runCliUntilOutput(
      ["connect", "/tmp/positional.sock"],
      env,
      "Connecting to /tmp/positional.sock",
    );
    expect(result.triggered).toBe(true);
    expect(result.stderr).not.toContain("renderer-parent connect requires an address");
  });
});

describe("plushie connect: token resolution", () => {
  test("--token flag is used when provided", async () => {
    // Token is satisfied by the flag; should proceed to "Connecting to..."
    const env = { ...process.env };
    delete env["PLUSHIE_TOKEN"];
    const result = await runCliUntilOutput(
      ["connect", "/tmp/no-such.sock", "--token", "flagtoken"],
      env,
      "Connecting to",
    );
    expect(result.triggered).toBe(true);
    expect(result.stderr).not.toContain("renderer-parent token");
  });

  test("PLUSHIE_TOKEN env is used when no --token flag", async () => {
    const env = { ...process.env, PLUSHIE_TOKEN: "envtoken" };
    const result = await runCliUntilOutput(["connect", "/tmp/no-such.sock"], env, "Connecting to");
    expect(result.triggered).toBe(true);
    expect(result.stderr).not.toContain("renderer-parent token");
  });

  test("--token flag takes precedence over PLUSHIE_TOKEN env", async () => {
    const env = { ...process.env, PLUSHIE_TOKEN: "envtoken" };
    const result = await runCliUntilOutput(
      ["connect", "/tmp/no-such.sock", "--token", "flagtoken"],
      env,
      "Connecting to",
    );
    expect(result.triggered).toBe(true);
    expect(result.stderr).not.toContain("renderer-parent token");
  });

  test("stdin JSON line is used when no flag or env", async () => {
    // Provide the token via stdin; should proceed to "Connecting to..."
    const env = { ...process.env };
    delete env["PLUSHIE_TOKEN"];
    const result = await runCliUntilOutput(
      ["connect", "/tmp/no-such.sock"],
      env,
      "Connecting to",
      JSON.stringify({ token: "stdintoken" }) + "\n",
    );
    expect(result.triggered).toBe(true);
    expect(result.stderr).not.toContain("renderer-parent token");
  });

  test("errors when stdin is closed with no data and no other token source", async () => {
    const env = { ...process.env };
    delete env["PLUSHIE_TOKEN"];
    // stdinData is undefined -> stdin.end() is called immediately
    const result = await runCli(["connect", "/tmp/no-such.sock"], env);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("renderer-parent token not provided");
  });

  test("errors on invalid JSON from stdin", async () => {
    const env = { ...process.env };
    delete env["PLUSHIE_TOKEN"];
    const result = await runCli(["connect", "/tmp/no-such.sock"], env, "not-valid-json\n");
    expect(result.code).toBe(1);
    expect(result.stderr).toContain(
      "renderer-parent token stdin must be JSON object with 'token' string",
    );
  });

  test("errors when stdin JSON is valid but missing 'token' string", async () => {
    const env = { ...process.env };
    delete env["PLUSHIE_TOKEN"];
    const result = await runCli(
      ["connect", "/tmp/no-such.sock"],
      env,
      JSON.stringify({ other: "field" }) + "\n",
    );
    expect(result.code).toBe(1);
    expect(result.stderr).toContain(
      "renderer-parent token stdin must be JSON object with 'token' string",
    );
  });

  test("errors when stdin JSON 'token' field is not a string", async () => {
    const env = { ...process.env };
    delete env["PLUSHIE_TOKEN"];
    const result = await runCli(
      ["connect", "/tmp/no-such.sock"],
      env,
      JSON.stringify({ token: 42 }) + "\n",
    );
    expect(result.code).toBe(1);
    expect(result.stderr).toContain(
      "renderer-parent token stdin must be JSON object with 'token' string",
    );
  });
});

import { type ChildProcess, spawn } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
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
  return new Promise((resolveRun, reject) => {
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
      resolveRun(code ?? 1);
    });
  });
}

function spawnCli(args: string[], cwd: string, env: NodeJS.ProcessEnv): ChildProcess {
  return spawn(
    resolvePath(repoRoot, "node_modules", ".bin", "tsx"),
    [resolvePath(repoRoot, "src", "cli", "index.ts"), ...args],
    {
      cwd,
      env,
      stdio: "ignore",
    },
  );
}

async function readEvents(path: string): Promise<Array<Record<string, unknown>>> {
  try {
    const raw = await readFile(path, "utf-8");
    return raw
      .trim()
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  } catch {
    return [];
  }
}

async function waitFor(
  check: () => Promise<boolean>,
  timeoutMs = 5_000,
  intervalMs = 50,
): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await check()) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, intervalMs));
  }
  throw new Error("timed out waiting for condition");
}

function writeFakeTsx(path: string): void {
  writeExecutable(
    path,
    [
      "#!/usr/bin/env node",
      'const fs = require("node:fs");',
      "const marker = process.env.PLUSHIE_TSX_MARKER;",
      "const event = {",
      '  event: "start",',
      "  args: process.argv.slice(2),",
      "  format: process.env.PLUSHIE_FORMAT ?? null,",
      "  binary: process.env.PLUSHIE_BINARY_PATH ?? null,",
      "};",
      'fs.appendFileSync(marker, JSON.stringify(event) + "\\n");',
      'process.on("SIGTERM", () => {',
      '  fs.appendFileSync(marker, JSON.stringify({ event: "term" }) + "\\n");',
      "  process.exit(0);",
      "});",
      "if (process.env.PLUSHIE_TSX_EXIT !== undefined) {",
      "  process.exit(Number(process.env.PLUSHIE_TSX_EXIT));",
      "}",
      "setInterval(() => {}, 1000);",
    ].join("\n"),
  );
}

describe("plushie dev", () => {
  test("runs one child and preserves its exit code with no-watch", async () => {
    const dir = mkdtempSync(join(tmpdir(), "plushie-cli-dev-"));
    tempDirs.push(dir);

    const binDir = join(dir, "bin");
    const projectDir = join(dir, "project");
    const marker = join(dir, "tsx-events.jsonl");
    mkdirSync(binDir, { recursive: true });
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(projectDir, "app.ts"), "", "utf-8");
    writeFakeTsx(join(binDir, "tsx"));

    const code = await runCli(
      ["dev", "app.ts", "--no-watch", "--json", "--binary", "/tmp/plushie"],
      projectDir,
      {
        ...process.env,
        PATH: `${binDir}${delimiter}${process.env["PATH"] ?? ""}`,
        PLUSHIE_TSX_EXIT: "7",
        PLUSHIE_TSX_MARKER: marker,
      },
    );

    const events = await readEvents(marker);

    expect(code).toBe(7);
    expect(events).toEqual([
      { event: "start", args: ["app.ts"], format: "json", binary: "/tmp/plushie" },
    ]);
  });

  test("uses the dev server to restart the child after a source change", async () => {
    const dir = mkdtempSync(join(tmpdir(), "plushie-cli-dev-"));
    tempDirs.push(dir);

    const binDir = join(dir, "bin");
    const projectDir = join(dir, "project");
    const appFile = join(projectDir, "app.ts");
    const marker = join(dir, "tsx-events.jsonl");
    mkdirSync(binDir, { recursive: true });
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(appFile, "export const version = 1;\n", "utf-8");
    writeFakeTsx(join(binDir, "tsx"));

    const child = spawnCli(["dev", "app.ts"], projectDir, {
      ...process.env,
      PATH: `${binDir}${delimiter}${process.env["PATH"] ?? ""}`,
      PLUSHIE_TSX_MARKER: marker,
    });

    try {
      await waitFor(async () => {
        const starts = (await readEvents(marker)).filter((event) => event["event"] === "start");
        return starts.length === 1;
      });

      writeFileSync(appFile, "export const version = 2;\n", "utf-8");

      await waitFor(async () => {
        const events = await readEvents(marker);
        const starts = events.filter((event) => event["event"] === "start");
        const stops = events.filter((event) => event["event"] === "term");
        return starts.length >= 2 && stops.length >= 1;
      });

      const events = await readEvents(marker);
      const starts = events.filter((event) => event["event"] === "start");

      expect(starts.length).toBeGreaterThanOrEqual(2);
      expect(starts).toContainEqual({
        event: "start",
        args: ["app.ts"],
        format: null,
        binary: null,
      });
    } finally {
      child.kill("SIGTERM");
      await new Promise((resolveExit) => child.once("exit", resolveExit));
    }
  });
});

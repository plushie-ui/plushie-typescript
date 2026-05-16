import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { warnIfNotGitignored } from "../../src/cli/gitignore.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "plushie-gitignore-"));
  tempDirs.push(dir);
  return dir;
}

function initRepo(dir: string): void {
  const init = spawnSync("git", ["init", "--quiet", dir], { stdio: "pipe" });
  if (init.status !== 0) {
    throw new Error(`git init failed: ${init.stderr?.toString() ?? ""}`);
  }
}

function captureWarnings(): { write: (text: string) => void; output: () => string } {
  let buffer = "";
  return {
    write: (text) => {
      buffer += text;
    },
    output: () => buffer,
  };
}

describe("warnIfNotGitignored", () => {
  test("stays silent when not inside a git repository", () => {
    const dir = tempDir();
    mkdirSync(join(dir, "bin"));
    const cap = captureWarnings();

    warnIfNotGitignored("bin", { cwd: dir, writeStderr: cap.write });

    expect(cap.output()).toBe("");
  });

  test("stays silent when the path is already gitignored", () => {
    const dir = tempDir();
    initRepo(dir);
    mkdirSync(join(dir, "bin"));
    writeFileSync(join(dir, ".gitignore"), "/bin/\n", "utf-8");
    const cap = captureWarnings();

    warnIfNotGitignored("bin", { cwd: dir, writeStderr: cap.write });

    expect(cap.output()).toBe("");
  });

  test("warns when inside a repo and the path is not gitignored", () => {
    const dir = tempDir();
    initRepo(dir);
    mkdirSync(join(dir, "dist"));
    const cap = captureWarnings();

    warnIfNotGitignored("dist", { cwd: dir, writeStderr: cap.write });

    const output = cap.output();
    expect(output).toContain("warning: dist/ is not in .gitignore.");
    expect(output).toContain("      /dist/");
    expect(output).toContain("generated artifacts don't end");
  });

  test("stays silent when git is unavailable", () => {
    const dir = tempDir();
    const cap = captureWarnings();

    warnIfNotGitignored("dist", {
      cwd: dir,
      spawn: () => ({ status: null, error: new Error("git: not found") }),
      writeStderr: cap.write,
    });

    expect(cap.output()).toBe("");
  });
});

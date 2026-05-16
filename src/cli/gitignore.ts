/**
 * Friendly gitignore warning for known CLI output directories.
 *
 * When `plushie download` or `plushie package` writes generated
 * artifacts to a project-relative path, this helper checks whether
 * the path is gitignored and prints a recommendation to stderr if
 * not. Outside a git work tree the check is silent: the warning is
 * a nudge, not a hard failure.
 *
 * Detection uses `git` directly via `spawnSync` so we avoid taking a
 * runtime dependency on a git library for a one-shot check.
 *
 * @module
 */

import { type SpawnSyncOptions, spawnSync } from "node:child_process";
import { relative, resolve } from "node:path";

/**
 * Options for {@link warnIfNotGitignored}. The defaults exist so tests
 * can swap in a custom spawn and stderr writer without globals.
 */
export interface WarnIfNotGitignoredOptions {
  /** Working directory the git commands run in. Defaults to `process.cwd()`. */
  readonly cwd?: string;
  /** Spawn function used for git probes. Defaults to `spawnSync`. */
  readonly spawn?: (
    command: string,
    args: readonly string[],
    options?: SpawnSyncOptions,
  ) => { status: number | null; error?: Error };
  /** Where to emit the warning. Defaults to `process.stderr.write`. */
  readonly writeStderr?: (text: string) => void;
}

/**
 * Warn (to stderr) when `path` is inside a git work tree but is not
 * gitignored. No-ops when not inside a repo or when the path is
 * already ignored.
 *
 * `path` may be absolute or relative; relative paths are resolved
 * against `cwd` (default: `process.cwd()`). The warning text uses a
 * git-style project-relative path so the suggested `.gitignore` line
 * is copy-pasteable.
 */
export function warnIfNotGitignored(path: string, options: WarnIfNotGitignoredOptions = {}): void {
  const cwd = options.cwd ?? process.cwd();
  const spawn = options.spawn ?? spawnSync;
  const writeStderr = options.writeStderr ?? ((text: string) => process.stderr.write(text));

  const absolute = resolve(cwd, path);

  // Skip silently when not inside a git work tree. Covers both
  // "not a repo" and "git not installed".
  const inside = spawn("git", ["rev-parse", "--is-inside-work-tree"], {
    cwd,
    stdio: "pipe",
  });
  if (inside.error || inside.status !== 0) {
    return;
  }

  // Skip silently when the path is already gitignored.
  const ignored = spawn("git", ["check-ignore", "-q", absolute], {
    cwd,
    stdio: "pipe",
  });
  if (!ignored.error && ignored.status === 0) {
    return;
  }

  // Display path: project-relative when possible, falling back to the
  // user-provided string. Strip any trailing slash; the message
  // template adds its own.
  const display = stripTrailingSlash(relative(cwd, absolute) || path);
  const ignoreLine = `/${display}/`;

  writeStderr(
    `warning: ${display}/ is not in .gitignore.\n` +
      `  Recommended: add the following line so generated artifacts don't end\n` +
      `  up committed:\n` +
      `\n` +
      `      ${ignoreLine}\n`,
  );
}

function stripTrailingSlash(path: string): string {
  return path.endsWith("/") ? path.slice(0, -1) : path;
}

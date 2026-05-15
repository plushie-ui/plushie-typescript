import { randomUUID } from "node:crypto";
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

export const PACKAGE_READY_FILE_ENV = "PLUSHIE_PACKAGE_READY_FILE";

export function writePackageReadyFileFromEnv(env: NodeJS.ProcessEnv = process.env): void {
  const path = env[PACKAGE_READY_FILE_ENV];
  if (path === undefined || path === "") return;

  writePackageReadyFile(path);
}

function writePackageReadyFile(path: string): void {
  const readyPath = resolve(path);
  const readyDir = dirname(readyPath);
  const tempPath = join(readyDir, `.${basename(readyPath)}.${process.pid}.${randomUUID()}.tmp`);

  mkdirSync(readyDir, { recursive: true });
  try {
    writeFileSync(tempPath, "ready\n", "utf-8");
    renameSync(tempPath, readyPath);
  } catch (error) {
    rmSync(tempPath, { force: true });
    throw error;
  }
}

import { describe, expect, test } from "vitest";
import { platformBinaryName } from "../../src/client/binary.js";

describe("platformBinaryName", () => {
  test("returns a string with platform and arch", () => {
    const name = platformBinaryName();
    expect(name).toMatch(/^plushie-(darwin|linux|windows)-(x86_64|aarch64)/);
  });

  test("does not end with .exe on non-windows", () => {
    // This test is platform-dependent; on Linux/macOS it should not have .exe
    if (process.platform !== "win32") {
      expect(platformBinaryName()).not.toContain(".exe");
    }
  });
});

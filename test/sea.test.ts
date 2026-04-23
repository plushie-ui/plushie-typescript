import { join } from "node:path";
import { describe, expect, test, vi } from "vitest";
import { extractedSEABinaryPath, makeExtractedBinaryExecutable } from "../src/sea.js";

describe("extractedSEABinaryPath", () => {
  test("adds the Windows executable extension", () => {
    expect(extractedSEABinaryPath({ platform: "win32", pid: 42, tempDir: "/tmp" })).toBe(
      join("/tmp", "plushie-sea-42.exe"),
    );
  });

  test("does not add an extension on Unix platforms", () => {
    expect(extractedSEABinaryPath({ platform: "linux", pid: 42, tempDir: "/tmp" })).toBe(
      join("/tmp", "plushie-sea-42"),
    );
  });
});

describe("makeExtractedBinaryExecutable", () => {
  test("skips chmod on Windows", () => {
    const chmod = vi.fn();

    makeExtractedBinaryExecutable("C:\\Temp\\plushie-sea-42.exe", "win32", chmod);

    expect(chmod).not.toHaveBeenCalled();
  });

  test("chmods extracted binaries on Unix platforms", () => {
    const chmod = vi.fn();

    makeExtractedBinaryExecutable("/tmp/plushie-sea-42", "linux", chmod);

    expect(chmod).toHaveBeenCalledWith("/tmp/plushie-sea-42", 0o755);
  });

  test("keeps non-Windows chmod failures visible", () => {
    const chmodError = new Error("permission denied");
    const chmod = vi.fn(() => {
      throw chmodError;
    });

    expect(() => makeExtractedBinaryExecutable("/tmp/plushie-sea-42", "darwin", chmod)).toThrow(
      chmodError,
    );
  });
});

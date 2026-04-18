import { describe, expect, test } from "vitest";
import { resolveCargoPlushie } from "../../src/cli/cargo-plushie.js";
import { PLUSHIE_RUST_VERSION } from "../../src/client/binary.js";

describe("resolveCargoPlushie", () => {
  test("uses the source-path checkout when PLUSHIE_RUST_SOURCE_PATH is set", () => {
    const inv = resolveCargoPlushie({
      env: { PLUSHIE_RUST_SOURCE_PATH: "/tmp/plushie-rust" },
      // Probe should never be called; flag it if it is.
      probeInstalled: () => {
        throw new Error("probe must not be called when the env var is set");
      },
    });

    expect(inv.source).toBe("source-path");
    expect(inv.command).toBe("cargo");
    expect(inv.argsPrefix).toEqual([
      "run",
      "--manifest-path",
      "/tmp/plushie-rust/Cargo.toml",
      "-p",
      "cargo-plushie",
      "--release",
      "--quiet",
      "--",
    ]);
  });

  test("uses the installed binary when it matches the expected version", () => {
    const inv = resolveCargoPlushie({
      env: {},
      probeInstalled: () => ({ found: true, version: PLUSHIE_RUST_VERSION }),
    });

    expect(inv.source).toBe("installed");
    expect(inv.command).toBe("cargo-plushie");
    expect(inv.argsPrefix).toEqual([]);
  });

  test("throws a clear error when cargo-plushie is missing and no source path is set", () => {
    expect(() =>
      resolveCargoPlushie({
        env: {},
        probeInstalled: () => ({ found: false }),
      }),
    ).toThrow(/cargo install cargo-plushie --version/);
  });

  test("throws a clear error when the installed version does not match", () => {
    expect(() =>
      resolveCargoPlushie({
        env: {},
        probeInstalled: () => ({ found: true, version: "0.0.1" }),
        expectedVersion: "9.9.9",
      }),
    ).toThrow(/found cargo-plushie 0\.0\.1, expected 9\.9\.9/);
  });

  test("PLUSHIE_RUST_SOURCE_PATH wins even if an installed binary is present", () => {
    const inv = resolveCargoPlushie({
      env: { PLUSHIE_RUST_SOURCE_PATH: "/tmp/source" },
      probeInstalled: () => ({ found: true, version: PLUSHIE_RUST_VERSION }),
    });

    expect(inv.source).toBe("source-path");
  });
});

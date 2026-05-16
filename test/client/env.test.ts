import { describe, expect, test } from "vitest";
import { buildRendererEnv } from "../../src/client/env.js";

describe("buildRendererEnv", () => {
  test("includes whitelisted exact variables", () => {
    // HOME and PATH should generally be present
    const env = buildRendererEnv();
    if (process.env["HOME"]) {
      expect(env["HOME"]).toBe(process.env["HOME"]);
    }
  });

  test("excludes non-whitelisted variables", () => {
    // Set a temp var and verify it's excluded
    const original = process.env["SECRET_TOKEN"];
    process.env["SECRET_TOKEN"] = "should-not-appear";
    const env = buildRendererEnv();
    expect(env["SECRET_TOKEN"]).toBeUndefined();
    if (original !== undefined) {
      process.env["SECRET_TOKEN"] = original;
    } else {
      delete process.env["SECRET_TOKEN"];
    }
  });

  test("includes prefix-matched variables", () => {
    const original = process.env["LC_ALL"];
    process.env["LC_ALL"] = "en_US.UTF-8";
    const env = buildRendererEnv();
    expect(env["LC_ALL"]).toBe("en_US.UTF-8");
    if (original !== undefined) {
      process.env["LC_ALL"] = original;
    } else {
      delete process.env["LC_ALL"];
    }
  });

  test("forwards PLUSHIE_NO_CATCH_UNWIND to renderer", () => {
    const original = process.env["PLUSHIE_NO_CATCH_UNWIND"];
    process.env["PLUSHIE_NO_CATCH_UNWIND"] = "1";
    const env = buildRendererEnv();
    expect(env["PLUSHIE_NO_CATCH_UNWIND"]).toBe("1");
    if (original !== undefined) {
      process.env["PLUSHIE_NO_CATCH_UNWIND"] = original;
    } else {
      delete process.env["PLUSHIE_NO_CATCH_UNWIND"];
    }
  });

  test("blocks host-side and secret PLUSHIE_* vars from renderer env", () => {
    // These are host-side, launcher-set, or secret variables that must not
    // reach the renderer subprocess. Enumerate known names explicitly so any
    // future relaxation is a deliberate, reviewed change.
    const blocked = [
      "PLUSHIE_TOKEN",
      "PLUSHIE_SOCKET",
      "PLUSHIE_TRANSPORT",
      "PLUSHIE_FORMAT",
      "PLUSHIE_RUST_SOURCE_PATH",
      "PLUSHIE_BINARY_PATH",
      "PLUSHIE_PACKAGE_DIR",
      "PLUSHIE_PACKAGE_READY_FILE",
      "PLUSHIE_RELEASE_BASE_URL",
      "PLUSHIE_CACHE_DIR",
    ];

    const saved: Record<string, string | undefined> = {};
    for (const name of blocked) {
      saved[name] = process.env[name];
      process.env[name] = "should-not-reach-renderer";
    }

    const env = buildRendererEnv();

    for (const name of blocked) {
      expect(env[name], `${name} must not reach renderer`).toBeUndefined();
    }

    for (const name of blocked) {
      if (saved[name] !== undefined) {
        process.env[name] = saved[name];
      } else {
        delete process.env[name];
      }
    }
  });

  test("strips non-whitelisted secrets", () => {
    const original = process.env["AWS_ACCESS_KEY_ID"];
    process.env["AWS_ACCESS_KEY_ID"] = "must-not-leak";
    const env = buildRendererEnv();
    expect(env["AWS_ACCESS_KEY_ID"]).toBeUndefined();
    if (original !== undefined) {
      process.env["AWS_ACCESS_KEY_ID"] = original;
    } else {
      delete process.env["AWS_ACCESS_KEY_ID"];
    }
  });

  test("overrides RUST_LOG when specified", () => {
    const env = buildRendererEnv({ rustLog: "plushie=debug" });
    expect(env["RUST_LOG"]).toBe("plushie=debug");
  });
});

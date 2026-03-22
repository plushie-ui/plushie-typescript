import { describe, expect, test } from "vitest"
import { buildRendererEnv } from "../../src/client/env.js"

describe("buildRendererEnv", () => {
  test("includes whitelisted exact variables", () => {
    // HOME and PATH should generally be present
    const env = buildRendererEnv()
    if (process.env["HOME"]) {
      expect(env["HOME"]).toBe(process.env["HOME"])
    }
  })

  test("excludes non-whitelisted variables", () => {
    // Set a temp var and verify it's excluded
    const original = process.env["SECRET_TOKEN"]
    process.env["SECRET_TOKEN"] = "should-not-appear"
    const env = buildRendererEnv()
    expect(env["SECRET_TOKEN"]).toBeUndefined()
    if (original !== undefined) {
      process.env["SECRET_TOKEN"] = original
    } else {
      delete process.env["SECRET_TOKEN"]
    }
  })

  test("includes prefix-matched variables", () => {
    const original = process.env["LC_ALL"]
    process.env["LC_ALL"] = "en_US.UTF-8"
    const env = buildRendererEnv()
    expect(env["LC_ALL"]).toBe("en_US.UTF-8")
    if (original !== undefined) {
      process.env["LC_ALL"] = original
    } else {
      delete process.env["LC_ALL"]
    }
  })

  test("overrides RUST_LOG when specified", () => {
    const env = buildRendererEnv({ rustLog: "plushie=debug" })
    expect(env["RUST_LOG"]).toBe("plushie=debug")
  })
})

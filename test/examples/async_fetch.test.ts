import { describe, test, expect } from "vitest"
import asyncFetch from "../../examples/async_fetch.js"

describe("async_fetch example", () => {
  test("exports a valid app definition", () => {
    expect(asyncFetch.config).toBeDefined()
    expect(asyncFetch.config.view).toBeTypeOf("function")
    expect(asyncFetch.run).toBeTypeOf("function")
  })

  test("init produces correct model shape", () => {
    const init = asyncFetch.config.init as Record<string, unknown>
    expect(init).toHaveProperty("status")
    expect(init).toHaveProperty("result")
    expect(init).toHaveProperty("error")
    expect(init["status"]).toBe("idle")
    expect(init["result"]).toBeNull()
    expect(init["error"]).toBeNull()
  })

  test("view produces a UINode tree", () => {
    const model = asyncFetch.config.init
    const tree = asyncFetch.config.view(model as any)
    expect(typeof tree === "object" && tree !== null && "type" in tree).toBe(true)
    if (typeof tree === "object" && tree !== null && "type" in tree) {
      expect(tree.type).toBe("window")
    }
  })

  test("has update handler for async events", () => {
    expect(asyncFetch.config.update).toBeTypeOf("function")
  })
})

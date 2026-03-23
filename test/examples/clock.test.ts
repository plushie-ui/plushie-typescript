import { describe, test, expect } from "vitest"
import clock from "../../examples/clock.js"

describe("clock example", () => {
  test("exports a valid app definition", () => {
    expect(clock.config).toBeDefined()
    expect(clock.config.view).toBeTypeOf("function")
    expect(clock.run).toBeTypeOf("function")
  })

  test("init produces a model with a time string", () => {
    const init = clock.config.init as { time: string }
    expect(init.time).toBeTypeOf("string")
    expect(init.time.length).toBeGreaterThan(0)
  })

  test("view produces a UINode tree", () => {
    const model = clock.config.init as { time: string }
    const tree = clock.config.view(model as any)
    expect(typeof tree === "object" && tree !== null && "type" in tree).toBe(true)
    if (typeof tree === "object" && tree !== null && "type" in tree) {
      expect(tree.type).toBe("window")
    }
  })

  test("has subscriptions", () => {
    expect(clock.config.subscriptions).toBeTypeOf("function")
    const subs = clock.config.subscriptions!(clock.config.init as any)
    expect(Array.isArray(subs)).toBe(true)
    expect(subs.length).toBeGreaterThan(0)
  })

  test("has update for timer events", () => {
    expect(clock.config.update).toBeTypeOf("function")
  })
})

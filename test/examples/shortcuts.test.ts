import { describe, test, expect } from "vitest"
import shortcuts from "../../examples/shortcuts.js"

describe("shortcuts example", () => {
  test("exports a valid app definition", () => {
    expect(shortcuts.config).toBeDefined()
    expect(shortcuts.config.view).toBeTypeOf("function")
    expect(shortcuts.run).toBeTypeOf("function")
  })

  test("init produces correct model shape", () => {
    const init = shortcuts.config.init as Record<string, unknown>
    expect(init).toHaveProperty("lastKey")
    expect(init).toHaveProperty("modifiers")
    expect(init["lastKey"]).toBe("(none)")
    expect(init["modifiers"]).toBe("")
  })

  test("view produces a UINode tree", () => {
    const model = shortcuts.config.init
    const tree = shortcuts.config.view(model as any)
    expect(typeof tree === "object" && tree !== null && "type" in tree).toBe(true)
    if (typeof tree === "object" && tree !== null && "type" in tree) {
      expect(tree.type).toBe("window")
    }
  })

  test("has subscriptions for key press events", () => {
    expect(shortcuts.config.subscriptions).toBeTypeOf("function")
    const subs = shortcuts.config.subscriptions!(shortcuts.config.init as any)
    expect(Array.isArray(subs)).toBe(true)
    expect(subs.length).toBeGreaterThan(0)
  })

  test("has update handler", () => {
    expect(shortcuts.config.update).toBeTypeOf("function")
  })
})

import { describe, test, expect } from "vitest"
import counter from "../../examples/counter.js"

describe("counter example", () => {
  test("exports a valid app definition", () => {
    expect(counter.config).toBeDefined()
    expect(counter.config.view).toBeTypeOf("function")
    expect(counter.run).toBeTypeOf("function")
  })

  test("init produces correct model", () => {
    const init = counter.config.init
    expect(init).toEqual({ count: 0 })
  })

  test("view produces a UINode tree", () => {
    const model = counter.config.init as { count: number }
    const tree = counter.config.view(model as any)
    expect(tree).toBeDefined()
    expect(typeof tree === "object" && tree !== null && "type" in tree).toBe(true)
    if (typeof tree === "object" && tree !== null && "type" in tree) {
      expect(tree.type).toBe("window")
      expect(tree.id).toBe("main")
    }
  })

  test("does not define update (uses inline handlers only)", () => {
    expect(counter.config.update).toBeUndefined()
  })
})

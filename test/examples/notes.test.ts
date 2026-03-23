import { describe, test, expect } from "vitest"
import notes from "../../examples/notes.js"

describe("notes example", () => {
  test("exports a valid app definition", () => {
    expect(notes.config).toBeDefined()
    expect(notes.config.view).toBeTypeOf("function")
    expect(notes.run).toBeTypeOf("function")
  })

  test("init produces correct model shape", () => {
    const init = notes.config.init as Record<string, unknown>
    expect(init).toHaveProperty("content")
    expect(init["content"]).toBe("")
  })

  test("view produces a UINode tree", () => {
    const model = notes.config.init
    const tree = notes.config.view(model as any)
    expect(typeof tree === "object" && tree !== null && "type" in tree).toBe(true)
    if (typeof tree === "object" && tree !== null && "type" in tree) {
      expect(tree.type).toBe("window")
    }
  })

  test("does not define update (uses inline handlers only)", () => {
    expect(notes.config.update).toBeUndefined()
  })
})

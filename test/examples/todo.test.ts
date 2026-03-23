import { describe, test, expect } from "vitest"
import todo from "../../examples/todo.js"

describe("todo example", () => {
  test("exports a valid app definition", () => {
    expect(todo.config).toBeDefined()
    expect(todo.config.view).toBeTypeOf("function")
    expect(todo.run).toBeTypeOf("function")
  })

  test("init produces correct model shape", () => {
    const init = todo.config.init as Record<string, unknown>
    expect(init).toHaveProperty("todos")
    expect(init).toHaveProperty("input")
    expect(init).toHaveProperty("filter")
    expect(init).toHaveProperty("nextId")
    expect(Array.isArray(init["todos"])).toBe(true)
    expect(init["input"]).toBe("")
    expect(init["filter"]).toBe("all")
    expect(init["nextId"]).toBe(1)
  })

  test("view produces a UINode tree", () => {
    const model = todo.config.init
    const tree = todo.config.view(model as any)
    expect(typeof tree === "object" && tree !== null && "type" in tree).toBe(true)
    if (typeof tree === "object" && tree !== null && "type" in tree) {
      expect(tree.type).toBe("window")
      expect(tree.id).toBe("main")
    }
  })

  test("has update handler", () => {
    expect(todo.config.update).toBeTypeOf("function")
  })
})

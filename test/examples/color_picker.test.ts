import { describe, test, expect } from "vitest"
import colorPicker from "../../examples/color_picker.js"

describe("color_picker example", () => {
  test("exports a valid app definition", () => {
    expect(colorPicker.config).toBeDefined()
    expect(colorPicker.config.view).toBeTypeOf("function")
    expect(colorPicker.run).toBeTypeOf("function")
  })

  test("init produces correct model shape", () => {
    const init = colorPicker.config.init as Record<string, unknown>
    expect(init).toHaveProperty("r")
    expect(init).toHaveProperty("g")
    expect(init).toHaveProperty("b")
    expect(init["r"]).toBeTypeOf("number")
    expect(init["g"]).toBeTypeOf("number")
    expect(init["b"]).toBeTypeOf("number")
  })

  test("view produces a UINode tree with slider children", () => {
    const model = colorPicker.config.init
    const tree = colorPicker.config.view(model as any)
    expect(typeof tree === "object" && tree !== null && "type" in tree).toBe(true)
    if (typeof tree === "object" && tree !== null && "type" in tree) {
      expect(tree.type).toBe("window")
      expect(tree.id).toBe("main")
    }
  })

  test("does not define update (uses inline handlers only)", () => {
    expect(colorPicker.config.update).toBeUndefined()
  })
})

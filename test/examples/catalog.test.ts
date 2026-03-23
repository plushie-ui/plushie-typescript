import { describe, test, expect } from "vitest"
import catalog from "../../examples/catalog.js"

describe("catalog example", () => {
  test("exports a valid app definition", () => {
    expect(catalog.config).toBeDefined()
    expect(catalog.config.view).toBeTypeOf("function")
    expect(catalog.run).toBeTypeOf("function")
  })

  test("init produces correct model", () => {
    const init = catalog.config.init as Record<string, unknown>
    expect(init["activeTab"]).toBe("layout")
    expect(init["checkboxChecked"]).toBe(false)
    expect(init["sliderValue"]).toBe(50)
    expect(init["progress"]).toBe(65)
  })

  test("view produces a UINode tree with catalog window", () => {
    const model = catalog.config.init
    const tree = catalog.config.view(model as any)
    expect(typeof tree === "object" && tree !== null && "type" in tree).toBe(true)
    if (typeof tree === "object" && tree !== null && "type" in tree) {
      expect(tree.type).toBe("window")
      expect(tree.id).toBe("catalog")
    }
  })

  test("has update for event handling", () => {
    expect(catalog.config.update).toBeTypeOf("function")
  })

  test("view renders each tab without errors", () => {
    const model = catalog.config.init as Record<string, unknown>
    for (const tab of ["layout", "input", "display", "composite"]) {
      const tabModel = { ...model, activeTab: tab }
      const tree = catalog.config.view(tabModel as any)
      expect(tree).toBeDefined()
    }
  })
})

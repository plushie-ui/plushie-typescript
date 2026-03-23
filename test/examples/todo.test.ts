import { describe, test, expect } from "vitest"
import todo from "../../examples/todo.js"
import { normalize, findById } from "../../src/tree/index.js"
import type { UINode, WidgetEvent } from "../../src/types.js"

const widgetEvent = (type: string, id: string, opts?: Partial<WidgetEvent>): WidgetEvent => ({
  kind: "widget",
  type: type as WidgetEvent["type"],
  id,
  scope: [],
  value: null,
  data: null,
  ...opts,
})

describe("todo example", () => {
  const initModel = todo.config.init as Record<string, unknown>
  const update = todo.config.update!

  test("init produces empty todo list", () => {
    expect(initModel["todos"]).toEqual([])
    expect(initModel["input"]).toBe("")
    expect(initModel["filter"]).toBe("all")
  })

  test("input event updates the input field", () => {
    const result = update(initModel as never, widgetEvent("input", "new_todo", { value: "Buy milk" }))
    expect((result as Record<string, unknown>)["input"]).toBe("Buy milk")
  })

  test("submit with text creates a todo and returns focus command", () => {
    const withInput = { ...initModel, input: "Buy milk" }
    const result = update(withInput as never, widgetEvent("submit", "new_todo"))
    expect(Array.isArray(result)).toBe(true)
    const [model] = result as [Record<string, unknown>, unknown]
    expect((model["todos"] as unknown[]).length).toBe(1)
    expect(model["input"]).toBe("")
  })

  test("submit with empty input does nothing", () => {
    const result = update(initModel as never, widgetEvent("submit", "new_todo"))
    const m = (Array.isArray(result) ? result[0] : result) as Record<string, unknown>
    expect((m["todos"] as unknown[]).length).toBe(0)
  })

  test("filter buttons change the filter", () => {
    let result = update(initModel as never, widgetEvent("click", "filter_done"))
    let m = (Array.isArray(result) ? result[0] : result) as Record<string, unknown>
    expect(m["filter"]).toBe("done")

    result = update(initModel as never, widgetEvent("click", "filter_active"))
    m = (Array.isArray(result) ? result[0] : result) as Record<string, unknown>
    expect(m["filter"]).toBe("active")

    result = update(initModel as never, widgetEvent("click", "filter_all"))
    m = (Array.isArray(result) ? result[0] : result) as Record<string, unknown>
    expect(m["filter"]).toBe("all")
  })

  test("view produces a window with text input", () => {
    const tree = normalize(todo.config.view(initModel as never) as UINode)
    expect(tree.type).toBe("window")
    const input = findById(tree, "app/new_todo")
    expect(input).not.toBeNull()
    expect(input!.type).toBe("text_input")
  })

  test("view renders todo items with scoped IDs", () => {
    const withTodo = {
      ...initModel,
      todos: [{ id: "todo_1", text: "Buy milk", done: false }],
    }
    const tree = normalize(todo.config.view(withTodo as never) as UINode)
    const toggle = findById(tree, "app/list/todo_1/toggle")
    expect(toggle).not.toBeNull()
  })
})

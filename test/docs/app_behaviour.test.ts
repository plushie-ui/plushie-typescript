import { expect, test } from "vitest"
import { Command, Subscription, COMMAND } from "../../src/index.js"
import {
  window, column, row, text, button, textInput, checkbox, container,
} from "../../src/ui/index.js"
import { normalize, findById } from "../../src/tree/index.js"
import type { WidgetEvent, WindowEvent } from "../../src/types.js"

// -- init examples reproduced from docs/app-behaviour.md --

test("app_behaviour_init_bare_model", () => {
  const model = { todos: [], input: "", filter: "all" }
  expect(model.todos).toEqual([])
  expect(model.input).toBe("")
  expect(model.filter).toBe("all")
})

test("app_behaviour_init_with_command", () => {
  const model = { todos: [], loading: true }
  const cmd = Command.async(async () => "loaded", "todosLoaded")
  const init: [typeof model, typeof cmd] = [model, cmd]

  expect(init[0].loading).toBe(true)
  expect(init[0].todos).toEqual([])
  expect(init[1].type).toBe("async")
  expect(init[1].payload["tag"]).toBe("todosLoaded")
})

// -- update examples --

interface Model {
  todos: Array<{ id: number; text: string; done: boolean }>
  input: string
  filter: string
  autoRefresh: boolean
  nextId: number
}

function newModel(overrides: Partial<Model> = {}): Model {
  return {
    todos: [], input: "", filter: "all", autoRefresh: false, nextId: 1,
    ...overrides,
  }
}

test("app_behaviour_update_add_todo", () => {
  let model = newModel()
  // Simulate input event
  model = { ...model, input: "Buy milk" }

  // Simulate click on add_todo
  const newTodo = { id: model.nextId, text: model.input, done: false }
  model = {
    ...model,
    todos: [newTodo, ...model.todos],
    input: "",
    nextId: model.nextId + 1,
  }

  expect(model.input).toBe("")
  expect(model.todos).toHaveLength(1)
  expect(model.todos[0]!.text).toBe("Buy milk")
  expect(model.todos[0]!.done).toBe(false)
})

test("app_behaviour_update_submit_returns_focus", () => {
  let model = newModel({ input: "Walk dog" })

  const newTodo = { id: model.nextId, text: model.input, done: false }
  model = {
    ...model,
    todos: [newTodo, ...model.todos],
    input: "",
    nextId: model.nextId + 1,
  }
  const cmd = Command.focus("todoField")

  expect(model.input).toBe("")
  expect(model.todos[0]!.text).toBe("Walk dog")
  expect(cmd.type).toBe("focus")
  expect(cmd.payload["target"]).toBe("todoField")
})

// -- view example --

test("app_behaviour_view_basic_structure", () => {
  const model = { input: "Buy milk", todos: [{ id: "todo_1", text: "Walk dog", done: false }] }

  const tree = normalize(
    window("main", { title: "Todos" }, [
      column({ padding: 16, spacing: 8 }, [
        row({ spacing: 8 }, [
          textInput("todoField", model.input, { placeholder: "What needs doing?" }),
          button("addTodo", "Add"),
        ]),
        ...model.todos.map(todo =>
          row({ id: todo.id, spacing: 8 }, [
            checkbox("toggle", todo.done),
            text(todo.text),
          ])
        ),
      ]),
    ])
  )

  expect(tree.type).toBe("window")
  expect(tree.id).toBe("main")
  expect(tree.props["title"]).toBe("Todos")

  const [col] = tree.children
  expect(col!.type).toBe("column")

  const [inputRow, todoRow] = col!.children
  expect(inputRow!.type).toBe("row")

  const [input, btn] = inputRow!.children
  expect(input!.type).toBe("text_input")
  expect(input!.props["value"]).toBe("Buy milk")
  expect(btn!.type).toBe("button")
  expect(btn!.props["label"]).toBe("Add")

  expect(todoRow!.type).toBe("row")
  expect(todoRow!.id).toBe("todo_1")
})

// -- subscribe example --

test("app_behaviour_subscribe_without_auto_refresh", () => {
  const model = newModel({ autoRefresh: false })
  const subs = [
    Subscription.onKeyPress("keyEvent"),
  ]

  expect(subs).toHaveLength(1)
  expect(subs[0]!.type).toBe("on_key_press")
  expect(subs[0]!.tag).toBe("keyEvent")
})

test("app_behaviour_subscribe_with_auto_refresh", () => {
  const model = newModel({ autoRefresh: true })
  const subs = [
    Subscription.onKeyPress("keyEvent"),
    ...(model.autoRefresh ? [Subscription.every(5000, "refresh")] : []),
  ]

  expect(subs).toHaveLength(2)
  const timer = subs.find(s => s.type === "every")
  expect(timer).toBeDefined()
  expect(timer!.tag).toBe("refresh")
  expect(timer!.interval).toBe(5000)
})

// -- settings example --

test("app_behaviour_settings", () => {
  const settings = {
    defaultFont: { family: "monospace" },
    defaultTextSize: 16,
    antialiasing: true,
    fonts: ["fonts/Inter.ttf"],
  }

  expect(settings.defaultTextSize).toBe(16)
  expect(settings.antialiasing).toBe(true)
  expect(settings.fonts).toEqual(["fonts/Inter.ttf"])
  expect(settings.defaultFont).toEqual({ family: "monospace" })
})

// -- windowConfig example --

test("app_behaviour_window_config_returns_map", () => {
  const config = {
    title: "My App",
    width: 800,
    height: 600,
    minSize: [400, 300],
    resizable: true,
    theme: "dark",
  }

  expect(config.title).toBe("My App")
  expect(config.width).toBe(800)
  expect(config.height).toBe(600)
  expect(config.resizable).toBe(true)
  expect(config.theme).toBe("dark")
})

// -- window commands --

test("app_behaviour_window_command_set_mode", () => {
  const cmd = Command.setWindowMode("main", "fullscreen")
  expect(cmd.type).toBe("window_op")
  expect(cmd.payload["window_id"]).toBe("main")
  expect(cmd.payload["mode"]).toBe("fullscreen")
})

test("app_behaviour_window_close_command", () => {
  const cmd = Command.closeWindow("main")
  expect(cmd.type).toBe("close_window")
  expect(cmd.payload["window_id"]).toBe("main")
})

// -- window events --

test("app_behaviour_window_events_close_requested", () => {
  const event: WindowEvent = {
    kind: "window", type: "close_requested", windowId: "inspector", tag: "", data: null,
  }
  let model = { inspectorOpen: true }

  if (event.type === "close_requested" && event.windowId === "inspector") {
    model = { ...model, inspectorOpen: false }
  }

  expect(model.inspectorOpen).toBe(false)
})

test("app_behaviour_window_events_resized", () => {
  const event: WindowEvent = {
    kind: "window", type: "resized", windowId: "main",
    tag: "", data: { width: 1024, height: 768 },
  }
  let model = { windowSize: { width: 0, height: 0 } }

  if (event.type === "resized" && event.windowId === "main") {
    const d = event.data as Record<string, number>
    model = { ...model, windowSize: { width: d["width"]!, height: d["height"]! } }
  }

  expect(model.windowSize).toEqual({ width: 1024, height: 768 })
})

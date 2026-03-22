import { app, Command, isInput, isSubmit, isClick } from '../src/index.js'
import type { Event, WidgetEvent, Handler } from '../src/index.js'
import { window, column, row, text, button, textInput, container, checkbox } from '../src/ui/index.js'
import type { UINode } from '../src/index.js'

interface Todo {
  id: string
  text: string
  done: boolean
}

type Filter = "all" | "active" | "done"

interface Model {
  todos: Todo[]
  input: string
  filter: Filter
  nextId: number
}

// -- Inline handlers for toggle and delete, using scoped IDs ----------------

const toggleTodo: Handler<Model> = (s, e: WidgetEvent) => ({
  ...s,
  todos: s.todos.map((t) =>
    t.id === e.scope[0] ? { ...t, done: !t.done } : t,
  ),
})

const deleteTodo: Handler<Model> = (s, e: WidgetEvent) => ({
  ...s,
  todos: s.todos.filter((t) => t.id !== e.scope[0]),
})

// -- View helpers -----------------------------------------------------------

function filtered(model: Model): readonly Todo[] {
  switch (model.filter) {
    case "active":
      return model.todos.filter((t) => !t.done)
    case "done":
      return model.todos.filter((t) => t.done)
    default:
      return model.todos
  }
}

function todoRow(todo: Todo): UINode {
  return container(todo.id, {}, [
    row({ spacing: 8 }, [
      checkbox("toggle", todo.done, { onToggle: toggleTodo }),
      text(todo.text),
      button("delete", "x", { onClick: deleteTodo }),
    ]),
  ])
}

// -- App --------------------------------------------------------------------

export default app<Model>({
  init: { todos: [], input: "", filter: "all", nextId: 1 },

  update(state, event: Event) {
    if (isInput(event, "new_todo")) {
      return { ...state, input: String(event.value) }
    }
    if (isSubmit(event, "new_todo")) {
      if (state.input.trim() === "") return state
      const todo: Todo = {
        id: `todo_${state.nextId}`,
        text: state.input,
        done: false,
      }
      return [
        { ...state, todos: [todo, ...state.todos], input: "", nextId: state.nextId + 1 },
        Command.focus("app/new_todo"),
      ] as const
    }
    if (isClick(event, "filter_all")) return { ...state, filter: "all" as const }
    if (isClick(event, "filter_active")) return { ...state, filter: "active" as const }
    if (isClick(event, "filter_done")) return { ...state, filter: "done" as const }
    return state
  },

  view: (s) =>
    window("main", { title: "Todos" }, [
      column({ id: "app", padding: 20, spacing: 12, width: "fill" }, [
        text("title", "My Todos", { size: 24 }),
        textInput("new_todo", s.input, { placeholder: "What needs doing?", onSubmit: true }),
        row({ spacing: 8 }, [
          button("filter_all", "All"),
          button("filter_active", "Active"),
          button("filter_done", "Done"),
        ]),
        column({ id: "list", spacing: 4 }, filtered(s).map(todoRow)),
      ]),
    ]),
})

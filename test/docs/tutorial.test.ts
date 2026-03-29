import { expect, test } from "vitest";
import { Command } from "../../src/index.js";
import { findById, normalize } from "../../src/tree/index.js";
import type { WidgetEvent } from "../../src/types.js";
import {
  button,
  checkbox,
  column,
  container,
  row,
  text,
  textInput,
  window,
} from "../../src/ui/index.js";

// Types and handlers reproduced from docs/tutorial.md

interface Todo {
  id: string;
  text: string;
  done: boolean;
}

interface Model {
  todos: Todo[];
  input: string;
  filter: "all" | "active" | "done";
  nextId: number;
}

function initModel(): Model {
  return { todos: [], input: "", filter: "all", nextId: 1 };
}

const handleInput = (s: Model, e: WidgetEvent): Model => ({
  ...s,
  input: e.value as string,
});

const addTodo = (s: Model): Model | [Model, ReturnType<typeof Command.focus>] => {
  if (!s.input.trim()) return s;
  const todo = { id: `todo_${s.nextId}`, text: s.input, done: false };
  return [
    { ...s, todos: [todo, ...s.todos], input: "", nextId: s.nextId + 1 },
    Command.focus("app/newTodo"),
  ];
};

const toggleTodo = (s: Model, e: WidgetEvent): Model => ({
  ...s,
  todos: s.todos.map((t) => (t.id === e.scope[0] ? { ...t, done: !t.done } : t)),
});

const deleteTodo = (s: Model, e: WidgetEvent): Model => ({
  ...s,
  todos: s.todos.filter((t) => t.id !== e.scope[0]),
});

function filtered(s: Model): Todo[] {
  switch (s.filter) {
    case "active":
      return s.todos.filter((t) => !t.done);
    case "done":
      return s.todos.filter((t) => t.done);
    default:
      return s.todos;
  }
}

// -- Step 1: init and initial view --

test("tutorial_step1_init", () => {
  const model = initModel();
  expect(model.todos).toEqual([]);
  expect(model.input).toBe("");
  expect(model.filter).toBe("all");
  expect(model.nextId).toBe(1);
});

test("tutorial_step1_view", () => {
  const _model = initModel();
  const tree = normalize(
    window("main", { title: "Todos" }, [
      column({ id: "app", padding: 20, spacing: 12, width: "fill" }, [
        text("title", "My Todos", { size: 24 }),
        text("No todos yet"),
      ]),
    ]),
  );

  expect(tree.type).toBe("window");
  expect(tree.id).toBe("main");
  expect(tree.props["title"]).toBe("Todos");

  const [col] = tree.children;
  expect(col!.type).toBe("column");
  expect(col!.id).toBe("app");
  expect(col!.props["spacing"]).toBe(12);
  expect(col!.props["width"]).toBe("fill");

  const [titleNode, emptyNode] = col!.children;
  expect(titleNode!.type).toBe("text");
  expect(titleNode!.props["content"]).toBe("My Todos");
  expect(titleNode!.props["size"]).toBe(24);
  expect(emptyNode!.type).toBe("text");
  expect(emptyNode!.props["content"]).toBe("No todos yet");
});

// -- Step 2: input handling --

test("tutorial_step2_input_updates_model", () => {
  const model = initModel();
  const event: WidgetEvent = {
    kind: "widget",
    type: "input",
    id: "newTodo",
    scope: [],
    value: "Buy milk",
    data: null,
    windowId: "main",
  };
  const updated = handleInput(model, event);
  expect(updated.input).toBe("Buy milk");
});

test("tutorial_step2_submit_creates_todo", () => {
  let model = initModel();
  model = { ...model, input: "Buy milk" };
  const result = addTodo(model);

  expect(Array.isArray(result)).toBe(true);
  const [newModel, cmd] = result as [Model, ReturnType<typeof Command.focus>];
  expect(newModel.input).toBe("");
  expect(newModel.nextId).toBe(2);
  expect(newModel.todos).toHaveLength(1);
  expect(newModel.todos[0]!.text).toBe("Buy milk");
  expect(newModel.todos[0]!.id).toBe("todo_1");
  expect(newModel.todos[0]!.done).toBe(false);
  expect(cmd.type).toBe("focus");
});

test("tutorial_step2_empty_submit_does_nothing", () => {
  let model = initModel();
  model = { ...model, input: "   " };
  const result = addTodo(model);
  // Should return bare model, not a tuple
  expect(Array.isArray(result)).toBe(false);
  expect((result as Model).todos).toEqual([]);
});

// -- Step 3: rendering the list with scoped IDs --

test("tutorial_step3_view_renders_todo_list", () => {
  const model: Model = {
    todos: [
      { id: "todo_1", text: "Buy milk", done: false },
      { id: "todo_2", text: "Walk dog", done: true },
    ],
    input: "",
    filter: "all",
    nextId: 3,
  };

  const tree = normalize(
    window("main", { title: "Todos" }, [
      column({ id: "app", padding: 20, spacing: 12, width: "fill" }, [
        text("title", "My Todos", { size: 24 }),
        textInput("newTodo", model.input, { placeholder: "What needs doing?" }),
        column(
          { id: "list", spacing: 4 },
          model.todos.map((todo) =>
            container(todo.id, {}, [
              row({ spacing: 8 }, [
                checkbox("toggle", todo.done),
                text(todo.text),
                button("delete", "x"),
              ]),
            ]),
          ),
        ),
      ]),
    ]),
  );

  const listCol = findById(tree, "app/list");
  expect(listCol).not.toBeNull();
  expect(listCol!.type).toBe("column");
  expect(listCol!.props["spacing"]).toBe(4);

  expect(listCol!.children).toHaveLength(2);
  const [row1, row2] = listCol!.children;
  expect(row1!.id).toBe("app/list/todo_1");
  expect(row1!.type).toBe("container");
  expect(row2!.id).toBe("app/list/todo_2");
});

test("tutorial_step3_todo_row_structure", () => {
  const model: Model = {
    todos: [{ id: "todo_1", text: "Buy milk", done: false }],
    input: "",
    filter: "all",
    nextId: 2,
  };

  const tree = normalize(
    window("main", { title: "Todos" }, [
      column({ id: "app", padding: 20, spacing: 12, width: "fill" }, [
        column(
          { id: "list", spacing: 4 },
          model.todos.map((todo) =>
            container(todo.id, {}, [
              row({ spacing: 8 }, [
                checkbox("toggle", todo.done),
                text(todo.text),
                button("delete", "x"),
              ]),
            ]),
          ),
        ),
      ]),
    ]),
  );

  const cont = findById(tree, "app/list/todo_1");
  expect(cont).not.toBeNull();
  expect(cont!.type).toBe("container");

  const [innerRow] = cont!.children;
  expect(innerRow!.type).toBe("row");
  expect(innerRow!.props["spacing"]).toBe(8);

  const [cb, textNode, btn] = innerRow!.children;
  expect(cb!.type).toBe("checkbox");
  expect(cb!.id).toBe("app/list/todo_1/toggle");
  expect(cb!.props["checked"]).toBe(false);
  expect(textNode!.type).toBe("text");
  expect(textNode!.props["content"]).toBe("Buy milk");
  expect(btn!.type).toBe("button");
  expect(btn!.id).toBe("app/list/todo_1/delete");
  expect(btn!.props["label"]).toBe("x");
});

// -- Step 4: toggle and delete --

test("tutorial_step4_toggle", () => {
  const model: Model = {
    todos: [{ id: "todo_1", text: "Buy milk", done: false }],
    input: "",
    filter: "all",
    nextId: 2,
  };

  const event: WidgetEvent = {
    kind: "widget",
    type: "toggle",
    id: "toggle",
    scope: ["todo_1", "list", "app"],
    value: true,
    data: null,
    windowId: "main",
  };

  const updated = toggleTodo(model, event);
  expect(updated.todos[0]!.done).toBe(true);
});

test("tutorial_step4_delete", () => {
  const model: Model = {
    todos: [{ id: "todo_1", text: "Buy milk", done: false }],
    input: "",
    filter: "all",
    nextId: 2,
  };

  const event: WidgetEvent = {
    kind: "widget",
    type: "click",
    id: "delete",
    scope: ["todo_1", "list", "app"],
    value: null,
    data: null,
    windowId: "main",
  };

  const updated = deleteTodo(model, event);
  expect(updated.todos).toEqual([]);
});

// -- Step 5: submit returns focus command --

test("tutorial_step5_submit_returns_focus_command", () => {
  const model: Model = { todos: [], input: "Buy milk", filter: "all", nextId: 1 };
  const result = addTodo(model);

  expect(Array.isArray(result)).toBe(true);
  const [, cmd] = result as [Model, ReturnType<typeof Command.focus>];
  expect(cmd.type).toBe("focus");
  expect(cmd.payload["target"]).toBe("app/newTodo");
});

// -- Step 6: filtering --

test("tutorial_step6_filter_toggle", () => {
  const model = initModel();
  const asActive: Model = { ...model, filter: "active" };
  expect(asActive.filter).toBe("active");
  const asAll: Model = { ...asActive, filter: "all" };
  expect(asAll.filter).toBe("all");
  const asDone: Model = { ...model, filter: "done" };
  expect(asDone.filter).toBe("done");
});

test("tutorial_step6_filtered_helper", () => {
  const model: Model = {
    todos: [
      { id: "todo_1", text: "Buy milk", done: false },
      { id: "todo_2", text: "Walk dog", done: true },
      { id: "todo_3", text: "Read book", done: false },
    ],
    input: "",
    filter: "all",
    nextId: 4,
  };

  expect(filtered(model)).toHaveLength(3);
  expect(filtered({ ...model, filter: "active" })).toHaveLength(2);
  expect(filtered({ ...model, filter: "done" })).toHaveLength(1);
});

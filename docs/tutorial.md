# Tutorial: building a todo app

This tutorial walks through building a complete todo app, introducing
one concept per step. By the end you'll understand text inputs,
dynamic lists, scoped IDs, commands, and conditional rendering.

## Step 1: the model

Start with a model that tracks a list of todos and the current input
text.

```tsx
import { app } from 'plushie'
import { Window, Column, Text } from 'plushie/ui'

interface Todo {
  id: string
  text: string
  done: boolean
}

interface Model {
  todos: Todo[]
  input: string
  filter: 'all' | 'active' | 'done'
  nextId: number
}

export default app<Model>({
  init: { todos: [], input: '', filter: 'all', nextId: 1 },

  view: (state) => (
    <Window id="main" title="Todos">
      <Column id="app" padding={20} spacing={12} width="fill">
        <Text id="title" size={24}>My Todos</Text>
        <Text>No todos yet</Text>
      </Column>
    </Window>
  ),
})
```

Run it with `npx plushie run todo.tsx`. You'll see a title and a
placeholder message. Not much yet, but the structure is in place:
`init` sets up state, `view` renders it.

## Step 2: adding a text input

Add a text input that updates the model on every keystroke, and a
submit handler that creates a todo when the user presses Enter.

```tsx
import { TextInput } from 'plushie/ui'

const handleInput = (s: Model, e: WidgetEvent): Model => ({
  ...s, input: e.value as string
})

const addTodo = (s: Model): Model => {
  if (!s.input.trim()) return s
  const todo = { id: `todo_${s.nextId}`, text: s.input, done: false }
  return { ...s, todos: [todo, ...s.todos], input: '', nextId: s.nextId + 1 }
}
```

And the view:

```tsx
view: (state) => (
  <Window id="main" title="Todos">
    <Column id="app" padding={20} spacing={12} width="fill">
      <Text id="title" size={24}>My Todos</Text>
      <TextInput id="newTodo" value={state.input}
        placeholder="What needs doing?"
        onInput={handleInput} onSubmit={addTodo} />
    </Column>
  </Window>
),
```

Type something and press Enter. The input clears (the model's
`input` resets to `""`), but you can't see the todos yet. Let's
fix that.

## Step 3: rendering the list with scoped IDs

Each todo needs its own row with a checkbox and a delete button.
We wrap each item in a `Container` using the todo's ID. This creates
a **scope** -- children get unique IDs automatically without manual
prefixing.

```tsx
import { Container, Row, Checkbox, Button } from 'plushie/ui'

// In the view, after the TextInput:
<Column id="list" spacing={4}>
  {filtered(state).map(todo => (
    <Container id={todo.id}>
      <Row spacing={8}>
        <Checkbox id="toggle" value={todo.done} onToggle={toggleTodo} />
        <Text>{todo.text}</Text>
        <Button id="delete" onClick={deleteTodo}>x</Button>
      </Row>
    </Container>
  ))}
</Column>
```

Each todo row has `id={todo.id}` (e.g., `"todo_1"`). Inside it,
the checkbox has local id `"toggle"` and the button has `"delete"`.
On the wire, these become `"list/todo_1/toggle"` and
`"list/todo_1/delete"` -- unique across all items.

## Step 4: handling toggle and delete with scope

When the checkbox or delete button is clicked, the event carries the
local `id` and a `scope` array with the todo's container ID as the
immediate parent. Read the scope to find which item was acted on:

```typescript
const toggleTodo = (s: Model, e: WidgetEvent): Model => ({
  ...s,
  todos: s.todos.map(t =>
    t.id === e.scope[0] ? { ...t, done: !t.done } : t
  ),
})

const deleteTodo = (s: Model, e: WidgetEvent): Model => ({
  ...s,
  todos: s.todos.filter(t => t.id !== e.scope[0]),
})
```

The `e.scope[0]` gives the immediate parent's ID (e.g., `"todo_1"`)
regardless of how deep the row is nested. If you later move the list
into a sidebar or tab, the pattern still works.

## Step 5: refocusing with a command

After submitting a todo, the text input loses focus. Let's refocus
it automatically using `Command.focus()`:

```typescript
import { Command } from 'plushie'

const addTodo = (s: Model): Model | [Model, Command] => {
  if (!s.input.trim()) return s
  const todo = { id: `todo_${s.nextId}`, text: s.input, done: false }
  return [
    { ...s, todos: [todo, ...s.todos], input: '', nextId: s.nextId + 1 },
    Command.focus('app/newTodo'),
  ]
}
```

Note the scoped path `"app/newTodo"` -- the text input is inside
the `"app"` column, so its full ID is `"app/newTodo"`. Commands
always use the full scoped path.

## Step 6: filtering

Add filter buttons that toggle between all, active, and completed
todos:

```tsx
<Row spacing={8}>
  <Button id="filterAll"
    onClick={(s: Model) => ({ ...s, filter: 'all' as const })}>All</Button>
  <Button id="filterActive"
    onClick={(s: Model) => ({ ...s, filter: 'active' as const })}>Active</Button>
  <Button id="filterDone"
    onClick={(s: Model) => ({ ...s, filter: 'done' as const })}>Done</Button>
</Row>
```

And the filter helper:

```typescript
function filtered(s: Model): Todo[] {
  switch (s.filter) {
    case 'active': return s.todos.filter(t => !t.done)
    case 'done':   return s.todos.filter(t => t.done)
    default:       return s.todos
  }
}
```

Extract the todo row as a view helper:

```tsx
function todoRow(todo: Todo) {
  return (
    <Container id={todo.id}>
      <Row spacing={8}>
        <Checkbox id="toggle" value={todo.done} onToggle={toggleTodo} />
        <Text>{todo.text}</Text>
        <Button id="delete" onClick={deleteTodo}>x</Button>
      </Row>
    </Container>
  )
}
```

## The complete app

The full source is in
[`examples/todo.ts`](../examples/todo.ts)
with tests in
[`test/examples/todo.test.ts`](../test/examples/todo.test.ts).

## What you've learned

- **Text inputs** with `onSubmit` for form-like behavior
- **Scoped IDs** via named containers (`<Container id={todo.id}>`)
- **Scope binding** in handlers (`e.scope[0]` for the parent ID)
- **Commands** for side effects (`Command.focus()` with scoped paths)
- **Conditional rendering** with filter functions
- **View helpers** extracted as regular functions

## Next steps

- [Commands](commands.md) -- async work, file dialogs, timers
- [Scoped IDs](scoped-ids.md) -- full scoping reference
- [Composition patterns](composition-patterns.md) -- scaling beyond
  a single module
- [Testing](testing.md) -- unit and integration testing

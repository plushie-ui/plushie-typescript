# App configuration

`app()` is the entry point for every plushie application. It accepts a
configuration object that defines your model, view, and event handling.

## Configuration

```typescript
import { app } from 'plushie'

export default app<Model>({
  init: { ... },                           // required
  view: (state) => ...,                    // required
  update: (state, event) => ...,           // optional
  subscriptions: (state) => [...],         // optional
  settings: { ... },                       // optional
  windowConfig: (state) => ({ ... }),      // optional
  handleRendererExit: (state, reason) => ..., // optional
})
```

### init

The initial model, optionally with commands. The model type is inferred
from `init` if you don't provide an explicit generic.

<!-- test: app_behaviour_init_bare_model, app_behaviour_init_with_command -- keep this code block in sync with the test -->
```typescript
// Bare model:
init: { todos: [], input: '', filter: 'all' }

// With a command:
init: [
  { todos: [], loading: true },
  Command.async(async () => loadTodosFromDisk(), 'todosLoaded'),
]
```

The model can be any object. The runtime does not inspect or modify
it -- it is fully owned by the app.

### view(state)

Receives the current model (as `DeepReadonly<Model>`), returns a UI
tree. Called after every state change. Must be a pure function of
the model.

<!-- test: app_behaviour_view_basic_structure -- keep this code block in sync with the test -->
```tsx
view: (state) => (
  <Window id="main" title="Todos">
    <Column padding={16} spacing={8}>
      <TextInput id="field" value={state.input}
        placeholder="What needs doing?" onInput={handleInput} />
      {state.todos.map(todo => todoRow(todo))}
    </Column>
  </Window>
),
```

The runtime diffs the returned tree against the previous one and sends
only patches to the renderer.

### Inline handlers

Widget events are handled by pure-function handlers on widget props.
Handlers receive the current state and event, return new state or
`[state, command]`:

```typescript
const increment = (s: Model): Model => ({ ...s, count: s.count + 1 })

// In JSX:
<Button id="inc" onClick={increment}>+</Button>

// With commands:
const addTodo = (s: Model): Model | [Model, Command] => {
  const todo = { id: `todo_${s.nextId}`, text: s.input, done: false }
  return [
    { ...s, todos: [todo, ...s.todos], input: '', nextId: s.nextId + 1 },
    Command.focus('app/newTodo'),
  ]
}
```

Handlers are pure functions -- they receive the current state as their
first argument (not captured via closure). This avoids stale state
issues and makes handlers independently testable.

### update(state, event) -- optional

Fallback handler for events without inline handlers. All non-widget
events (timers, async results, keyboard subscriptions) go here.
Widget events go here only if no inline handler is registered for
that widget + event type.

```typescript
import { isTimer, isAsync, isClick } from 'plushie'

update(state, event) {
  if (isTimer(event, 'tick')) return { ...state, time: Date.now() }
  if (isAsync(event, 'fetch')) {
    if (event.result.ok) return { ...state, data: event.result.value }
    return { ...state, error: String(event.result.error) }
  }
  return state
}
```

Common event type guards:

| Guard | Matches |
|---|---|
| `isClick(event, id?)` | Button click |
| `isInput(event, id?)` | Text input change |
| `isSubmit(event, id?)` | Text input Enter |
| `isToggle(event, id?)` | Checkbox/toggler |
| `isSlide(event, id?)` | Slider moved |
| `isSelect(event, id?)` | Pick list/radio |
| `isTimer(event, tag?)` | Timer fired |
| `isAsync(event, tag?)` | Async command result |
| `isKey(event, type?)` | Keyboard (via subscription) |
| `isWindow(event)` | Window lifecycle |
| `isModifiers(event)` | Modifier key state change |

See [Events](events.md) for the full taxonomy.

### subscriptions(state) -- optional

Returns a list of active subscriptions based on the current model.
Called after every state change. The runtime diffs the list and
starts/stops subscriptions automatically.

<!-- test: app_behaviour_subscribe_without_auto_refresh, app_behaviour_subscribe_with_auto_refresh -- keep this code block in sync with the test -->
```typescript
subscriptions: (state) => [
  Subscription.onKeyPress('keys'),
  state.autoRefresh && Subscription.every(5000, 'refresh'),
],
```

Falsy values (false, null, undefined) are filtered automatically.
Default: no subscriptions.

### settings -- optional

Application-level settings sent to the renderer on startup.

<!-- test: app_behaviour_settings -- keep this code block in sync with the test -->
```typescript
settings: {
  defaultFont: { family: 'monospace' },
  defaultTextSize: 16,
  antialiasing: true,
  fonts: ['fonts/Inter.ttf'],
  theme: 'dark',
},
```

| Key | Type | Default | Description |
|---|---|---|---|
| `defaultFont` | Font | system | Default font for all text |
| `defaultTextSize` | number | 16 | Default text size in pixels |
| `antialiasing` | boolean | false | Enable anti-aliasing |
| `vsync` | boolean | true | Vertical sync |
| `scaleFactor` | number | 1.0 | Global UI scale |
| `fonts` | string[] | [] | Font file paths to load |
| `theme` | string | -- | Built-in theme name or "system" |
| `defaultEventRate` | number | -- | Max events/sec for coalescable events |

### windowConfig(state) -- optional

Called when windows are opened, providing base settings that
per-window props override.

<!-- test: app_behaviour_window_config_returns_map -- keep this code block in sync with the test -->
```typescript
windowConfig: (state) => ({
  title: 'My App',
  width: 800,
  height: 600,
  minSize: [400, 300],
  resizable: true,
  theme: 'dark',
}),
```

### handleRendererExit(state, reason) -- optional

Called when the renderer process exits unexpectedly. Return the model
to use when the renderer restarts. Default: return model unchanged.

```typescript
handleRendererExit: (state, reason) => ({
  ...state, status: 'renderer_restarting'
}),
```

## Lifecycle

```
app(config).run()
  |
  v
init -> model + commands
  |
  v
view(model) -> initial tree -> send snapshot to renderer
  |
  v
subscriptions(model) -> active subscriptions
  |
  v
[event from renderer / subscription / command result]
  |
  v
handler(model, event) or update(model, event) -> model + commands
  |
  v
view(model) -> diff -> send patches to renderer
  |
  v
subscriptions(model) -> diff (start/stop as needed)
  |
  v
[repeat from event]
```

## Running

```typescript
// Programmatic:
const handle = await myApp.run()
handle.stop()

// Or via CLI:
// npx plushie run my-app.tsx
// npx plushie dev my-app.tsx   (with hot reload)
```

Options for `run()`:

| Option | Type | Default | Description |
|---|---|---|---|
| `binary` | string | auto-resolved | Path to plushie binary |
| `format` | 'msgpack' \| 'json' | 'msgpack' | Wire format |
| `args` | string[] | [] | Extra CLI args for renderer |
| `rustLog` | string | -- | RUST_LOG value for renderer |

## Multi-window

Windows are nodes in the view tree. If a window node is present, the
window is open; if it disappears, the window closes.

```tsx
view: (state) => {
  const windows = [
    <Window id="main" title="My App">
      {mainContent(state)}
    </Window>
  ]

  if (state.inspectorOpen) {
    windows.push(
      <Window id="inspector" title="Inspector" width={400} height={600}>
        {inspectorPanel(state)}
      </Window>
    )
  }

  return windows
}
```

Window IDs must be stable strings. The renderer uses them to track
which OS window corresponds to which tree node.

### Window events

Subscribe to window events and handle them in `update()`:

<!-- test: app_behaviour_window_events_close_requested, app_behaviour_window_events_resized -- keep this code block in sync with the test -->
```typescript
subscriptions: (state) => [
  Subscription.onWindowClose('windowClose'),
  Subscription.onWindowResize('windowResize'),
],

update(state, event) {
  if (isWindow(event) && event.type === 'close_requested') {
    if (event.windowId === 'inspector') {
      return { ...state, inspectorOpen: false }
    }
  }
  return state
}
```

## Testing

Handlers are pure functions. Test them directly:

```typescript
test('adding a todo', () => {
  const model = { todos: [], input: 'Buy milk', nextId: 1 }
  const result = addTodo(model)
  // result is [newModel, focusCommand]
  expect(result[0].todos[0].text).toBe('Buy milk')
  expect(result[0].input).toBe('')
})
```

For integration testing with the renderer, see [Testing](testing.md).

## Renderer limits

| Resource | Limit | Exceeded behavior |
|---|---|---|
| Font data (loadFont) | 16 MiB | Rejected |
| Runtime font loads | 256 per process | Rejected |
| Image handles | 4096 | Error response |
| Total image bytes | 1 GiB | Error response |
| Markdown content | 1 MiB | Truncated |
| Text editor content | 10 MiB | Truncated |
| Window size | 1..16384 px | Clamped |
| Tree depth | 256 levels | Rendering stops |

# Commands and subscriptions

Sometimes a handler needs to do more than return a new model. It might
need to focus a text input, start a network request, open a file
dialog, or schedule a delayed event. These are commands.

## Returning commands

Handlers and `update()` can return either a bare model or a
`[model, command]` tuple:

```typescript
// No commands -- just return the model:
const handleSimple = (s: Model) => s

// With a command -- return a tuple:
const handleSave = (s: Model) => [
  s,
  Command.async(async () => saveToServer(s.data), 'saveResult'),
]
```

Results arrive via `update()`:

```typescript
update(state, event) {
  if (isAsync(event, 'saveResult')) {
    if (event.result.ok) return { ...state, saved: true }
    return { ...state, error: String(event.result.error) }
  }
  return state
}
```

## Available commands

### Async work

Run a function asynchronously. The result is delivered as an
`AsyncEvent` with `{ ok: true, value }` or `{ ok: false, error }`.

```typescript
Command.async(async (signal: AbortSignal) => {
  const res = await fetch(url, { signal })
  return res.json()
}, 'fetchResult')
```

The function receives an `AbortSignal` for cooperative cancellation.
If the function throws, the error is delivered as
`{ ok: false, error }`.

### Streaming

`Command.stream()` runs an async generator. Each yielded value
produces a `StreamEvent`; the final return produces an `AsyncEvent`.

```typescript
Command.stream(async function*(signal) {
  const reader = file.stream().getReader()
  let count = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    count++
    yield { progress: count }
  }
  return { total: count }
}, 'fileImport')
```

Handle intermediate and final values:

```typescript
if (isStream(event, 'fileImport')) {
  return { ...state, rowsImported: (event.value as { progress: number }).progress }
}
if (isAsync(event, 'fileImport') && event.result.ok) {
  return { ...state, importing: false }
}
```

### Cancel

Cancel a running async or stream command by tag. Uses
`AbortController.abort()` for cooperative cancellation and
discards any future results via nonce checking.

```typescript
Command.cancel('fileImport')
```

### Focus and text editing

```typescript
Command.focus('app/email')          // focus a widget by scoped path
Command.focusNext()                  // focus next widget
Command.focusPrevious()              // focus previous widget
Command.selectAll('editor')          // select all text
Command.selectRange('editor', 5, 15) // select a range
Command.moveCursorTo('editor', 42)   // move cursor to position
Command.moveCursorToFront('editor')  // move to start
Command.moveCursorToEnd('editor')    // move to end
```

### Scrolling

```typescript
Command.scrollTo('list', 0, 100)  // absolute offset
Command.scrollBy('list', 0, 50)   // relative offset
Command.snapTo('list', 0.0, 0.5)  // relative position (0.0-1.0)
Command.snapToEnd('list')          // snap to end
```

### Window operations

```typescript
Command.closeWindow('settings')
Command.resizeWindow('main', 800, 600)
Command.moveWindow('main', 100, 100)
Command.maximizeWindow('main')
Command.minimizeWindow('main')
Command.setWindowMode('main', 'fullscreen')
Command.toggleMaximize('main')
Command.toggleDecorations('main')
Command.gainFocus('main')
Command.setWindowLevel('main', 'always_on_top')
Command.dragWindow('main')                    // start window drag
Command.setResizable('main', false)
Command.setMinSize('main', 400, 300)
Command.setMaxSize('main', 1920, 1080)
```

### Window queries

Results arrive as `SystemEvent` via `update()`:

```typescript
Command.getWindowSize('main', 'sizeResult')
Command.getWindowPosition('main', 'posResult')
Command.getSystemTheme('themeResult')
Command.getSystemInfo('infoResult')
```

### Timing

```typescript
Command.sendAfter(1000, myEvent)  // dispatch event after delay
```

### Effects (file dialogs, clipboard, notifications)

See [Effects](effects.md) for the full effects API.

### Batch

Combine multiple commands:

```typescript
Command.batch([
  Command.focus('email'),
  Command.scrollTo('form', 0, 0),
])
```

### None and exit

```typescript
Command.none()   // no-op
Command.exit()   // terminate the application
```

## Subscriptions

Subscriptions are ongoing event sources declared as a function of
state. The runtime diffs the list each cycle and starts/stops
subscriptions automatically.

```typescript
subscriptions: (state) => [
  Subscription.onKeyPress('keys'),
  state.autoRefresh && Subscription.every(5000, 'refresh'),
  Subscription.onMouseMove('mouse', { maxRate: 30 }),
],
```

### Timer

```typescript
Subscription.every(1000, 'tick')
// Produces: TimerEvent { kind: 'timer', tag: 'tick', timestamp: number }
```

### Keyboard

```typescript
Subscription.onKeyPress('keys')
Subscription.onKeyRelease('keys')
Subscription.onModifiersChanged('mods')
```

### Mouse

```typescript
Subscription.onMouseMove('mouse', { maxRate: 60 })
Subscription.onMouseButton('mouse')
Subscription.onMouseScroll('mouse')
```

### Window

```typescript
Subscription.onWindowClose('win')
Subscription.onWindowResize('win')
Subscription.onWindowFocus('win')
Subscription.onWindowUnfocus('win')
Subscription.onWindowMove('win')
Subscription.onWindowOpen('win')
Subscription.onWindowEvent('win')  // all window events
```

### Other

```typescript
Subscription.onTouch('touch')
Subscription.onIme('ime')
Subscription.onFileDrop('files')
Subscription.onAnimationFrame('frame', { maxRate: 60 })
Subscription.onThemeChange('theme')
Subscription.onEvent('all')  // catch-all
```

### Rate limiting

High-frequency subscriptions can be rate-limited:

```typescript
Subscription.onMouseMove('mouse', { maxRate: 30 })
// or:
Subscription.maxRate(Subscription.onMouseMove('mouse'), 30)
```

The renderer coalesces events between deliveries (latest value wins
for position events, delta accumulation for scroll events).

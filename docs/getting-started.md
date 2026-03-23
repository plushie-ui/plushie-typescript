# Getting started

Build native desktop GUIs from TypeScript. Plushie handles rendering
via iced (Rust) while you own state, logic, and UI trees in pure
TypeScript.

## Prerequisites

- **Node.js** 20+ (install via [nodejs.org](https://nodejs.org) or
  your package manager)
- **System libraries** for your platform (only needed for windowed
  mode -- mock and headless testing work without them):
  - Linux: display server headers (e.g. `libxkbcommon-dev`,
    `libwayland-dev` on Debian/Ubuntu)
  - macOS: Xcode command-line tools (`xcode-select --install`)
  - Windows: no additional dependencies

## Setup

### 1. Create a new project

```sh
mkdir my-app && cd my-app
npm init -y
```

### 2. Install plushie

```sh
npm install plushie
```

### 3. Download the renderer binary

```sh
npx plushie download
```

This downloads the precompiled plushie binary for your platform.
The binary is ~15 MB and is stored in `node_modules/.plushie/bin/`.

### 4. Configure TypeScript

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx",
    "jsxImportSource": "plushie"
  }
}
```

The `jsx` and `jsxImportSource` settings enable JSX syntax for
building view trees. If you prefer the function API, you can skip
these.

## Your first app: a counter

Create `counter.tsx`:

<!-- test: getting_started_counter_init, getting_started_counter_increment, getting_started_counter_decrement, getting_started_counter_view, getting_started_counter_view_after_increments -- keep this code block in sync with the test -->
```tsx
import { app } from 'plushie'
import { Window, Column, Row, Text, Button } from 'plushie/ui'

interface Model {
  count: number
}

const increment = (s: Model): Model => ({ ...s, count: s.count + 1 })
const decrement = (s: Model): Model => ({ ...s, count: s.count - 1 })

export default app<Model>({
  init: { count: 0 },

  view: (state) => (
    <Window id="main" title="Counter">
      <Column padding={16} spacing={8}>
        <Text id="count" size={20}>Count: {state.count}</Text>
        <Row spacing={8}>
          <Button id="increment" onClick={increment}>+</Button>
          <Button id="decrement" onClick={decrement}>-</Button>
        </Row>
      </Column>
    </Window>
  ),
})
```

Run it:

```sh
npx plushie run counter.tsx
```

A native window appears with the count and two buttons.

## How it works

Plushie follows an Elm-inspired architecture. Your app provides:

- **`init`** -- the initial model (any object).
- **`view(state)`** -- takes the model and returns a UI tree.
  Plushie diffs trees and sends only patches to the renderer.
- **`onClick`, `onInput`, etc.** -- pure-function handlers on
  widgets. They receive the current state and return new state.
  No closures, no mutation.
- **`update(state, event)`** (optional) -- fallback handler for
  events without inline handlers (timers, async results, keyboard
  subscriptions).
- **`subscriptions(state)`** (optional) -- returns a list of active
  subscriptions (timers, keyboard events).

See [App configuration](app-behaviour.md) for the full API.

## Event handling

Widget events are handled by inline handlers on the widget props:

```tsx
<Button id="save" onClick={(s) => ({ ...s, saved: true })}>Save</Button>
<TextInput id="email" value={state.email}
  onInput={(s, e) => ({ ...s, email: e.value as string })} />
```

For events that don't come from widgets (timers, async results,
keyboard subscriptions), use the `update` function with type guards:

```typescript
import { isTimer, isAsync } from 'plushie'

update(state, event) {
  if (isTimer(event, 'tick')) return { ...state, time: Date.now() }
  if (isAsync(event, 'fetch')) {
    if (event.result.ok) return { ...state, data: event.result.value }
  }
  return state
}
```

See [Events](events.md) for the full taxonomy.

## CLI commands

```sh
npx plushie run counter.tsx          # run an app
npx plushie dev counter.tsx          # run with hot reload
npx plushie dev counter.tsx --json   # use JSON wire format (debugging)
npx plushie download                 # download renderer binary
npx plushie download --wasm          # download WASM renderer
npx plushie build                    # build from Rust source
npx plushie inspect counter.tsx      # print UI tree as JSON
```

## Debugging

Use the JSON wire format to see messages between TypeScript and the
renderer:

```sh
npx plushie dev counter.tsx --json
```

Enable verbose renderer logging:

```sh
RUST_LOG=plushie=debug npx plushie run counter.tsx
```

## Error handling

If a handler or `update` throws, the runtime catches the exception,
logs it, and continues with the previous state. The GUI does not
crash. Fix the code and the next event works normally.

If you accidentally return a Promise from a handler, the runtime
detects it and logs a clear error explaining how to use
`Command.async()` instead.

## Dev mode

Hot reload without losing application state:

```sh
npx plushie dev counter.tsx
```

Edit your TypeScript file and save. The window updates instantly.
The model is preserved -- only `view()` is re-evaluated with the
new code.

## Next steps

- [Tutorial: building a todo app](tutorial.md) -- step-by-step guide
- Browse the [examples](../examples/) for patterns
- [App configuration](app-behaviour.md) -- full callback API
- [Layout](layout.md) -- sizing and positioning widgets
- [Commands](commands.md) -- async work, file dialogs, effects
- [Events](events.md) -- complete event taxonomy
- [Testing](testing.md) -- writing tests against your UI
- [Theming](theming.md) -- custom themes and palettes

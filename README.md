# plushie

Native desktop GUI framework for TypeScript, powered by
[iced](https://github.com/iced-rs/iced). Build native desktop apps
with TypeScript -- no webview, no Electron.

## Features

- **38 built-in widget types** -- buttons, text inputs, sliders,
  tables, markdown, canvas, and more.
  [Layout guide](docs/layout.md)
- **22 built-in themes** -- light, dark, dracula, nord, solarized,
  gruvbox, catppuccin, tokyo night, kanagawa, and more. Custom
  palettes and per-widget style overrides.
  [Theming guide](docs/theming.md)
- **JSX and function API** -- PascalCase JSX components or camelCase
  function calls. Both produce the same tree.
- **Type-safe widgets and events** -- every prop is typed, every
  event kind has a type guard.
  [Events guide](docs/events.md)
- **Three-tier testing** -- mock (sub-ms), headless (real rendering),
  windowed (real windows). All through the real binary.
  [Testing guide](docs/testing.md)
- **Multi-window** -- declare window nodes in your widget tree;
  the framework manages open/close/update automatically.
  [App config guide](docs/app-behaviour.md)
- **Platform effects** -- native file dialogs, clipboard, OS
  notifications.
  [Effects guide](docs/effects.md)
- **Accessibility** -- screen reader support via accesskit.
  [Accessibility guide](docs/accessibility.md)
- **Canvas** -- shape primitives, interactive shapes, path commands,
  transforms, gradients.
- **Hot reload** -- edit code, see changes instantly. Model preserved.
- **Extensions** -- compose existing widgets or build native Rust
  extensions with the `WidgetExtension` trait.
  [Extensions guide](docs/extensions.md)
- **WASM** -- run in the browser with WasmTransport.
- **SEA** -- bundle as a standalone executable.
- **Remote rendering** -- Unix socket, TCP, SSH via SocketTransport.
  [Running guide](docs/running.md)

## Quick start

```sh
npm install plushie
npx plushie download    # download the renderer binary
```

Create `counter.tsx`:

```tsx
import { app } from 'plushie'
import { Window, Column, Row, Text, Button } from 'plushie/ui'

type Model = { count: number }

const increment = (s: Model): Model => ({ ...s, count: s.count + 1 })
const decrement = (s: Model): Model => ({ ...s, count: s.count - 1 })

const counter = app<Model>({
  init: { count: 0 },
  view: (s) => (
    <Window id="main" title="Counter">
      <Column padding={16} spacing={8}>
        <Text id="count" size={20}>Count: {s.count}</Text>
        <Row spacing={8}>
          <Button id="increment" onClick={increment}>+</Button>
          <Button id="decrement" onClick={decrement}>-</Button>
        </Row>
      </Column>
    </Window>
  ),
})

counter.run()
```

Run it:

```sh
npx plushie run counter.tsx
```

This is one of [9 examples](examples/README.md) included in the repo, from a
minimal counter to a full widget catalog. Edit them while the GUI is
running and see changes instantly. For complete project demos,
including native Rust extensions, see the
[plushie-demos](https://github.com/plushie-ui/plushie-demos/tree/main/typescript)
repository.

## Architecture

Widget events use **inline pure-function handlers**. The runtime
injects the current state as the first argument -- no closures over
mutable state:

```ts
const increment = (state: Model): Model => ({
  ...state,
  count: state.count + 1,
})
```

Non-widget events (timers, async results, subscriptions) fall through
to an optional `update()` function:

```ts
app({
  init: { count: 0, time: '' },
  subscriptions: () => [Subscription.every(1000, 'tick')],
  update(state, event) {
    if (isTimer(event, 'tick')) {
      return { ...state, time: new Date().toLocaleTimeString() }
    }
    return state
  },
  view: (s) => ...
})
```

Both inline handlers and pure-update style work with the same
runtime. Use whichever fits.

## Widgets

**Layout**: column, row, container, overlay, scrollable, stack,
grid, keyed_column, responsive, pin, floating

**Display**: text, rich_text, markdown, image, svg, progress_bar,
qr_code, rule, space

**Input**: button, text_input, text_editor, checkbox, radio,
toggler, slider, vertical_slider, pick_list, combo_box

**Complex**: table, pane_grid, tooltip, mouse_area, sensor, themer,
window, canvas

All widgets have both a camelCase function API (`button("save", "Save")`)
and a PascalCase JSX component (`<Button id="save">Save</Button>`).

## Commands

Side effects are pure data. Return them from handlers or `update()`:

```ts
// Async work
Command.async(async (signal) => {
  const res = await fetch(url, { signal })
  return res.json()
}, 'fetchResult')

// Widget ops
Command.focus('form/email')

// Batching
Command.batch([Command.focus('input'), Command.scrollTo('list', 0, 0)])
```

## Testing

All testing runs through the real plushie binary -- no TypeScript mocks.

```ts
import { testWith } from 'plushie/testing'
import counter from './counter'

const test = testWith(counter)

test('increments on click', async ({ session }) => {
  await session.click('increment')
  expect(session.model().count).toBe(1)
  session.assertText('count', 'Count: 1')
})
```

Three backends, selectable via environment variable:

- **mock** -- sub-millisecond, no rendering (default)
- **headless** -- real rendering, no display server
- **windowed** -- real iced windows (needs display/Xvfb)

```sh
PLUSHIE_TEST_BACKEND=headless pnpm test
```

## Documentation

- [Getting started](docs/getting-started.md) -- setup and first app
- [Tutorial](docs/tutorial.md) -- build a todo app step by step
- [App configuration](docs/app-behaviour.md) -- init, update, view, subscriptions, multi-window
- [Events](docs/events.md) -- every event type with examples
- [Commands](docs/commands.md) -- async, focus, scroll, window ops, effects, subscriptions
- [Layout](docs/layout.md) -- sizing, padding, spacing, alignment
- [Scoped IDs](docs/scoped-ids.md) -- hierarchical widget identity
- [Effects](docs/effects.md) -- file dialogs, clipboard, notifications
- [Theming](docs/theming.md) -- built-in themes, custom palettes, StyleMap
- [Testing](docs/testing.md) -- unit tests, integration tests, three backends
- [Running](docs/running.md) -- local, remote, WASM, SEA, binary management
- [Composition patterns](docs/composition-patterns.md) -- tab bars, modals, cards
- [Accessibility](docs/accessibility.md) -- a11y props, roles, screen readers
- [Extensions](docs/extensions.md) -- custom widgets, Rust extensions
- [Builder internals](docs/builder-internals.md) -- how the SDK works under the hood
- [Examples](examples/README.md) -- all example apps

## Links

| | |
|---|---|
| TypeScript SDK | [github.com/plushie-ui/plushie-typescript](https://github.com/plushie-ui/plushie-typescript) |
| Elixir SDK | [github.com/plushie-ui/plushie-elixir](https://github.com/plushie-ui/plushie-elixir) |
| Renderer | [github.com/plushie-ui/plushie](https://github.com/plushie-ui/plushie) |
| Demo projects | [github.com/plushie-ui/plushie-demos](https://github.com/plushie-ui/plushie-demos) |

## License

MIT

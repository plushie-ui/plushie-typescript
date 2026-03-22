# plushie

Native desktop GUI framework for TypeScript, powered by
[iced](https://github.com/iced-rs/iced). Build native desktop apps
with TypeScript -- no webview, no Electron.

## Features

- Native rendering via iced (not a webview)
- Elm-inspired architecture with inline handlers
- JSX support (react-jsx transform)
- Type-safe widgets and events
- Three-tier testing (mock/headless/windowed)
- Hot reload dev server with state preservation
- Canvas shape system
- Platform effects (file dialogs, clipboard, notifications)

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

## Related projects

- [plushie](https://github.com/plushie-ui/plushie) -- Rust renderer binary
- [plushie-elixir](https://github.com/plushie-ui/plushie-elixir) -- Elixir SDK
- [plushie-gleam](https://github.com/plushie-ui/plushie-gleam) -- Gleam SDK

## License

MIT

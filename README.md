# plushie

Native desktop GUI framework for TypeScript, powered by
[iced](https://github.com/iced-rs/iced). **[Pre-1.0](#status)**

Build native desktop apps with TypeScript - no webview, no Electron.
Write your entire application in TypeScript (state, events, UI) and
get native windows on Linux, macOS, and Windows. The
[renderer](https://github.com/plushie-ui/plushie-rust) is built on
[Iced](https://github.com/iced-rs/iced) and ships as a precompiled
binary, no Rust toolchain required.

SDKs are also available for
[Elixir](https://github.com/plushie-ui/plushie-elixir),
[Gleam](https://github.com/plushie-ui/plushie-gleam),
[Python](https://github.com/plushie-ui/plushie-python), and
[Ruby](https://github.com/plushie-ui/plushie-ruby).

## Quick start

```sh
npm install plushie
npx plushie download    # sync bin/plushie, bin/plushie-renderer, and bin/plushie-launcher
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

The repo includes [several examples](examples/README.md) you can try.
Edit them while the GUI is running and see changes instantly. For
complete project demos, including native Rust extensions, see the
[plushie-demos](https://github.com/plushie-ui/plushie-demos/tree/main/typescript)
repo.

To add Plushie to your own project, see the
[getting started guide](docs/guides/02-getting-started.md),
or browse the [docs](docs/README.md) for all guides and references.

## How it works

Your TypeScript application and the renderer run as two OS processes
that exchange messages. Think of it like talking to a database,
except the database is a GPU-accelerated GUI toolkit. The SDK builds
UI trees and handles events; the renderer draws native windows and
captures input.

The SDK diffs each new tree against the previous one and sends only
the changes. If the renderer crashes, Plushie restarts it and
re-syncs your state.

The same protocol works over a local pipe, a Unix socket, TCP, SSH,
or any bidirectional byte stream. Your code doesn't need to change.

## Features

- **Elm architecture** - init, update, view. State lives in
  TypeScript, pure functions, predictable updates
- **JSX and function API** - PascalCase JSX components or camelCase
  function calls, both produce the same tree
- **Type-safe widgets and events** - every prop is typed, every
  event kind has a type guard
- **Built-in widgets** - layout, input, display, and interactive
  widgets out of the box
- **Canvas** - shapes, paths, gradients, transforms, and
  interactive elements for custom 2D drawing
- **Themes** - dark, light, nord, catppuccin, tokyo night, and
  more, with custom palettes and per-widget style overrides
- **Animation** - renderer-side transitions, springs, and
  sequences with no wire traffic per frame
- **Multi-window** - declare windows in your view; the framework
  manages the rest
- **Platform effects** - native file dialogs, clipboard, OS
  notifications
- **Accessibility** - keyboard navigation, screen readers, and
  focus management via [AccessKit](https://accesskit.dev)
- **Custom widgets** - compose existing widgets in pure TypeScript,
  draw on the canvas, or extend with native Rust
- **Hot reload** - edit code, see changes instantly with full
  state preservation
- **Remote rendering** - app on a server or embedded device,
  renderer on a display machine over SSH or any byte stream
- **WASM** - run in the browser with WasmTransport
- **SEA** - bundle as a standalone executable with no runtime
  dependencies

## Testing and automation

All testing runs through the real plushie binary - no TypeScript
mocks. Interact like a user: click, type, find elements, assert on
text. Three interchangeable backends:

- **Mock** - sub-millisecond tests, no display server
- **Headless** - real rendering via
  [tiny-skia](https://github.com/linebender/tiny-skia), supports
  screenshots for pixel regression in CI
- **Windowed** - real windows with GPU rendering, platform effects,
  real input

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

```sh
PLUSHIE_TEST_BACKEND=headless pnpm test
```

## Status

Pre-1.0. The core works (built-in widgets, event system, themes,
multi-window, testing framework, accessibility) but the API is
still evolving. Pin to an exact version and read the
[CHANGELOG](CHANGELOG.md) when upgrading.

## License

MIT

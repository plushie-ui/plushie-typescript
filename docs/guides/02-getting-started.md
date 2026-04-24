# Getting Started

## Prerequisites

You need Node.js 20 or newer. The `plushie` package declares
`"engines": { "node": ">=20" }`, and the SDK assumes native
`structuredClone`, `AbortController`, and top-level `await`,
all of which Node 20 provides.

Any package manager works. The examples below use `pnpm`;
`npm` and `yarn` behave the same way. Plushie runs on Linux,
macOS, and Windows.

## Creating a project

We will build the pad application from scratch. Start with a
fresh project:

```bash
mkdir plushie_pad
cd plushie_pad
pnpm init
```

Add `plushie` and `tsx` (used by the SDK's CLI to execute
TypeScript files directly):

```bash
pnpm add plushie
pnpm add -D tsx typescript
```

Pin to an exact version pre-1.0. The API may change between
minor releases. See the [versioning reference](../reference/versioning.md)
for the upgrade policy.

## Installing the renderer

Plushie apps communicate with a Rust binary (built on
[Iced](https://github.com/iced-rs/iced)) that handles rendering
and platform input. A `postinstall` script in the `plushie`
package downloads it automatically. If that step was skipped
(CI, `PLUSHIE_SKIP_DOWNLOAD=1`, offline install), fetch it by
hand:

```bash
npx plushie download
```

The binary lands at `node_modules/.plushie/bin/` and the SDK
resolves it at runtime. The download is pinned to the SDK
version so the binary and the SDK always match.

If you prefer to build the renderer yourself (or need to for
[native widgets](../reference/custom-widgets.md)), see the
[CLI commands reference](../reference/cli-commands.md). You
will need a Rust toolchain.

## Configuring TypeScript

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "plushie",

    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",

    "strict": true,
    "isolatedModules": true,
    "skipLibCheck": true
  }
}
```

The two lines that matter for Plushie are `"jsx": "react-jsx"`
and `"jsxImportSource": "plushie"`. Together they route JSX
through `plushie/jsx-runtime` without any plugin. The
[JSX and bundlers reference](../reference/jsx-and-bundlers.md)
covers the full recipe, including browser and WASM setups.

Also add `"type": "module"` to `package.json` if it is not
already there. The SDK is pure ESM.

## Your first window

Create `src/hello.tsx`:

```tsx
import { app } from "plushie"
import { Window, Text } from "plushie/ui"

type Model = Record<string, never>

const hello = app<Model>({
  init: {},
  view: () => (
    <Window id="main" title="Plushie Pad">
      <Text id="greeting">Hello from Plushie</Text>
    </Window>
  ),
})

hello.run()
```

Run it:

```bash
npx plushie run src/hello.tsx
```

A native window appears with the text "Hello from Plushie".
Close the window or press Ctrl+C in the terminal to stop.

Here is what each piece does:

- `app<Model>({ ... })` bundles the pieces that drive the Elm
  loop: `init` (the starting model), `view` (how the UI looks
  for a given model), and optionally `update` (for events that
  inline handlers do not cover). It returns an `AppDefinition<M>`.
- `.run()` resolves the renderer binary, starts the runtime,
  and keeps the process alive until the app exits. See the
  [app lifecycle reference](../reference/app-lifecycle.md) for
  the full signature.
- `<Window>` creates a native OS window. The `id` prop is the
  window ID (`"main"`) and `title` sets the title bar text.
  Every view returns either a `<Window>` or a list of windows.
- `<Text>` displays a read-only string. The `id` identifies
  the widget for event routing and for tests.

## The Elm loop: a counter

Let us add interactivity. Replace `src/hello.tsx` with a
counter:

```tsx
import { app, type DeepReadonly } from "plushie"
import { Button, Column, Row, Text, Window } from "plushie/ui"

type Model = { count: number }

const increment = (s: DeepReadonly<Model>): Model => ({
  ...s,
  count: s.count + 1,
})

const decrement = (s: DeepReadonly<Model>): Model => ({
  ...s,
  count: s.count - 1,
})

const counter = app<Model>({
  init: { count: 0 },
  view: (s) => (
    <Window id="main" title="Counter">
      <Column padding={16} spacing={8}>
        <Text id="count">Count: {s.count}</Text>
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

Run it again. Click "+" and "-". The count updates on every
click.

Here is what is new:

- `Model` is a plain object type with a `count` field. The
  model flows through `DeepReadonly<Model>` in handler
  signatures, so spread-based updates are canonical:
  `({ ...s, count: s.count + 1 })`. Never write `s.count++`;
  it is a type error and a runtime error in dev mode.
- `<Column>` stacks children top to bottom. `padding` adds
  space around the edges, `spacing` adds space between
  children. `<Row>` is the horizontal counterpart.
- `<Button>` is clickable. Its `onClick` prop is an inline
  handler that receives the current model and returns the new
  model. The SDK wires the event to the widget by `id`. For
  the full set of widget events and type guards, see the
  [events reference](../reference/events.md).

The cycle: you click "+". The renderer sends a click event.
The SDK calls the `onClick` handler with the current model.
Your function returns a new model. The SDK calls `view` with
that model, diffs the resulting tree against the previous
one, and sends patches to the renderer. The renderer updates
the display. The round trip happens in milliseconds.

Handlers can also return `[newModel, command]` when they need
to trigger a side effect. See the
[commands reference](../reference/commands.md) for the full
command catalog. Events the widgets do not handle (timers,
async results, system events) flow through `update(state, event)`
on the `app()` config; see the
[events reference](../reference/events.md) for the type-guard
pattern.

## Your first test

Plushie tests run under [Vitest](https://vitest.dev/) against
the real renderer binary in mock mode. Install it:

```bash
pnpm add -D vitest
```

Export the app from `src/hello.tsx` so tests can import it:

```tsx
export default counter
counter.run()
```

Create `test/hello.test.ts`:

```typescript
import { testWith } from "plushie/testing"
import { expect } from "vitest"
import counter from "../src/hello.js"

const test = testWith(counter)

test("clicking + increments the count", async ({ session }) => {
  await session.click("increment")
  expect(session.model().count).toBe(1)
  await session.assertText("count", "Count: 1")
})
```

Run it:

```bash
pnpm vitest run
```

`testWith(counter)` starts a real app instance against the
mock renderer. `session.click(id)` injects a click event and
waits for the resulting patch; `session.model()` returns the
current model; `session.assertText(id, text)` asserts on the
rendered text for a widget. We will add tests throughout the
guide to verify each chapter's work. The full testing story
lives in [chapter 15](15-testing.md) and the
[testing reference](../reference/testing.md).

## Hot reload during development

During development you want changes reflected without
restarting the app manually. Use `plushie dev`:

```bash
npx plushie dev src/hello.tsx
```

`dev` runs the app under `tsx --watch`. On a source file
change `tsx` restarts the process and the SDK reconnects to
the renderer. Try it: start the app, change the
`<Column padding={16} ...>` value to `32`, and save. The
window reappears with the new spacing.

Model state is not preserved across restarts; the app
reinitializes from `init`. For finer-grained hot reload with
state preservation, see the
[configuration reference](../reference/configuration.md).

This is how we will develop throughout the guide. Keep the
app running, edit code, save, and watch the window update.
In [chapter 4](04-the-development-loop.md) we wire this into
a longer-lived workflow.

## Project structure

A typical Plushie project looks like this:

```
plushie_pad/
  package.json
  tsconfig.json
  src/
    hello.tsx
    widgets/
  test/
    hello.test.ts
  node_modules/
    .plushie/
      bin/plushie-renderer-<os>-<arch>
```

`src/` holds your app code. Custom widgets live under
`src/widgets/`. Tests sit under `test/`. The renderer binary
is cached in `node_modules/.plushie/bin/`; it is regenerated
on `pnpm install` via the postinstall script.

Wire the CLI commands into `package.json` so teammates get
the same invocations:

```json
{
  "scripts": {
    "dev": "plushie dev src/hello.tsx",
    "start": "plushie run src/hello.tsx",
    "test": "vitest run"
  }
}
```

Then `pnpm dev`, `pnpm start`, and `pnpm test` do the right
thing without anyone remembering the flags. See the
[CLI commands reference](../reference/cli-commands.md) for
everything the `plushie` binary exposes.

## Try it

With the counter running and hot reload active, try these
changes one at a time. Save after each one and watch the
window update:

- Enlarge the count display: add a `size` prop to `<Text>`.
  `<Text id="count" size={24}>Count: {s.count}</Text>`.
- Add a reset button. Put
  `<Button id="reset" onClick={(s) => ({ ...s, count: 0 })}>Reset</Button>`
  in the row next to the other buttons.
- Flip the layout. Swap `<Column>` and `<Row>` to rearrange
  the widgets horizontally and vertically.

When you are comfortable with the init / view / handler
cycle and hot reload, move on to the next chapter and start
building the pad.

---

Next: [Your First App](03-your-first-app.md)

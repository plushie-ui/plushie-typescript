# Testing

## Philosophy

Progressive fidelity: test your app's logic with fast, pure unit tests;
promote to integration tests with the real renderer when you need
wire-protocol verification or pixel-accurate screenshots.

All integration testing goes through the real plushie binary. There
are no TypeScript-side mocks -- the mock backend in the binary is
fast enough (sub-millisecond per interaction) and provides real
protocol validation.


## Unit testing

Handlers are pure functions. Test them directly with vitest -- no
framework needed.

### Testing handlers

```typescript
import { describe, test, expect } from 'vitest'

const increment = (s: { count: number }) => ({ ...s, count: s.count + 1 })

test('increment increases count', () => {
  expect(increment({ count: 0 })).toEqual({ count: 1 })
  expect(increment({ count: 5 })).toEqual({ count: 6 })
})
```

### Testing handlers that return commands

Commands are frozen objects with a `type` and `payload`. Inspect
them directly:

```typescript
import { Command, COMMAND } from 'plushie'

test('submit refocuses the input', () => {
  const result = addTodo({ todos: [], input: 'Buy milk', nextId: 1 })
  const [model, cmd] = result as [Model, Command]

  expect(model.todos[0].text).toBe('Buy milk')
  expect(cmd.type).toBe('focus')
  expect(cmd.payload).toEqual({ target: 'app/newTodo' })
})

test('save triggers an async task', () => {
  const result = handleSave({ data: 'unsaved' })
  const [model, cmd] = result as [Model, Command]

  expect(cmd.type).toBe('async')
  expect(cmd.payload).toHaveProperty('tag', 'saveResult')
})
```

### Testing view output

```typescript
import { normalize, findById } from 'plushie/ui'

test('view shows todo count', () => {
  const model = { todos: [{ id: 't1', text: 'Buy milk', done: false }], input: '' }
  const tree = normalize(myApp.config.view(model as any))
  const counter = findById(tree, 'todoCount')

  expect(counter).not.toBeNull()
  expect(counter?.props['content']).toContain('1')
})
```

### Testing init

```typescript
test('init returns valid initial state', () => {
  const model = myApp.config.init
  expect(Array.isArray(model.todos)).toBe(true)
  expect(model.input).toBe('')
})
```

### Tree query helpers

The tree module provides helpers for querying view trees directly:

```typescript
import { findById, findAll, allIds } from 'plushie/ui'

findById(tree, 'myButton')              // find node by ID
findAll(tree, (node) => node.type === 'button')  // find by predicate
allIds(tree)                             // all IDs (depth-first)
```

These work on the raw `UINode` maps returned by `view()`. No test
session or backend required.


## Integration testing

Integration tests run your app against the real plushie renderer in
mock mode. The binary must be available (download with
`npx plushie download`).

### Quick start

```typescript
import { testWith } from 'plushie/testing'
import myApp from './my-app.js'

const test = testWith(myApp)

test('clicking increment updates the count', async ({ session }) => {
  await session.click('increment')
  expect(session.model().count).toBe(1)
  await session.assertText('count', 'Count: 1')
})
```

`testWith()` creates a vitest fixture that automatically creates and
destroys a test session for each test. Sessions are backed by a shared
binary process with multiplexed sessions for isolation.

### Manual session creation

```typescript
import { createSession } from 'plushie/testing'

test('manual session', async () => {
  const session = await createSession(myApp)
  try {
    await session.click('increment')
    expect(session.model().count).toBe(1)
  } finally {
    session.stop()
  }
})
```


## Selectors, interactions, and assertions

### Where do widget IDs come from?

Every widget in plushie gets an ID from the first argument to its
builder or from the `id` prop in JSX. For example,
`<Button id="saveBtn">Save</Button>` creates a button with ID
`"saveBtn"`.

When using selectors in tests, use the widget ID directly:

```typescript
await session.click('saveBtn')
await session.findOrThrow('saveBtn')
await session.assertText('saveBtn', 'Save')
```

### Interactions

Each sends an Interact wire message to the renderer and processes the
response events through the app's runtime:

| Function | Widget types | Event produced |
|---|---|---|
| `click(id)` | `button` | `WidgetEvent { type: "click" }` |
| `typeText(id, text)` | `text_input`, `text_editor` | `WidgetEvent { type: "input" }` |
| `submit(id)` | `text_input` | `WidgetEvent { type: "submit" }` |
| `toggle(id)` | `checkbox`, `toggler` | `WidgetEvent { type: "toggle" }` |
| `select(id, value)` | `pick_list`, `combo_box`, `radio` | `WidgetEvent { type: "select" }` |
| `slide(id, value)` | `slider`, `vertical_slider` | `WidgetEvent { type: "slide" }` |
| `press(key)` | global | `KeyEvent { type: "press" }` |
| `release(key)` | global | `KeyEvent { type: "release" }` |
| `typeKey(key)` | global | press + release |
| `moveTo(x, y)` | global | `MouseEvent { type: "moved" }` |
| `scroll(id, dx, dy)` | `scrollable` | `WidgetEvent { type: "scroll" }` |
| `paste(id, text)` | `text_input` | `WidgetEvent { type: "paste" }` |
| `sort(id, key)` | `table` | `WidgetEvent { type: "sort" }` |
| `canvasPress(id, x, y)` | `canvas` | `CanvasEvent { type: "press" }` |
| `canvasRelease(id, x, y)` | `canvas` | `CanvasEvent { type: "release" }` |
| `canvasMove(id, x, y)` | `canvas` | `CanvasEvent { type: "move" }` |

Interacting with the wrong widget type raises with an actionable hint:

```
cannot click a checkbox widget -- use toggle() instead
```

### Queries

```typescript
const el = await session.find('widgetId')         // by ID, returns Element | null
const el = await session.findOrThrow('widgetId')  // throws if not found
const el = await session.findByText('Hello')      // by text content
const el = await session.findByRole('button')     // by a11y role
const el = await session.findByLabel('Save')      // by a11y label
const el = await session.findFocused()            // focused widget
const tree = await session.queryTree()            // full renderer tree
```

The `Element` type has: `id`, `type`, `props`, `children`, `text`
(extracted from content/label/value props).

### State inspection

```typescript
const model = session.model()  // current app model (readonly)
const tree = session.tree()    // current normalized wire tree
```

### Assertions

```typescript
await session.assertText('count', 'Count: 5')
await session.assertExists('saveButton')
await session.assertNotExists('errorMessage')
session.assertModel({ count: 5 })
await session.assertRole('saveButton', 'button')
await session.assertA11y('input', { label: 'Email', required: true })
```

### Async

```typescript
session.timer('tick')                  // simulate a timer event
const event = await session.awaitAsync('fetchResult', 5000)
```

### Lifecycle

```typescript
session.reset()  // re-initialize the app to initial state
session.stop()   // close the session
```


## Three backends

All tests work on all backends. Write tests once, swap backends without
changing assertions.

### Backend comparison

| Feature | `:mock` | `:headless` | `:windowed` |
|---|---|---|---|
| **Speed** | ~ms | ~100ms | ~seconds |
| **Protocol round-trip** | Yes | Yes | Yes |
| **Structural tree hashes** | Yes | Yes | Yes |
| **Pixel screenshots** | No (stubs) | Yes (software) | Yes (GPU) |
| **Effects** | Cancelled | Cancelled | Executed |
| **Subscriptions** | Tracked, not fired | Tracked, not fired | Active |
| **Real rendering** | No | Yes (tiny-skia) | Yes (GPU) |
| **Real windows** | No | No | Yes |
| **Display server** | No | No | Yes (Xvfb in CI) |

- **mock** -- shared `plushie --mock` process with session
  multiplexing. Tests app logic, tree structure, and wire protocol.
  No rendering, no display, sub-millisecond. The right default for
  90% of tests.

- **headless** -- `plushie --headless` with software rendering via
  tiny-skia (no display server). Pixel screenshots for visual
  regression. Catches rendering bugs that mock mode can't.

- **windowed** -- `plushie` with real iced windows and GPU rendering.
  Effects execute, subscriptions fire, screenshots capture exactly
  what a user sees. Needs a display server (Xvfb or headless Weston).

### Backend selection

You never choose a backend in your test code. Backend selection is an
infrastructure decision made via environment variable.

| Priority | Source | Example |
|---|---|---|
| 1 | Environment variable | `PLUSHIE_TEST_BACKEND=headless pnpm test` |
| 2 | Default | `mock` |

```sh
pnpm test                                  # mock (default)
PLUSHIE_TEST_BACKEND=headless pnpm test    # real rendering
PLUSHIE_TEST_BACKEND=windowed pnpm test    # real windows
```

Tests are backend-agnostic -- the same test code works at all three
fidelity levels.


## Session pooling architecture

The mock and headless backends use a shared binary process for
performance. Instead of spawning one renderer per test, a single
`plushie --mock --max-sessions N` process handles all test sessions
via multiplexing.

How it works:

1. A shared binary process starts once (in vitest's `globalSetup` or
   `beforeAll` of a test suite).
2. Each test gets an isolated session via a unique session ID.
3. Every wire message carries a `session` field for routing.
4. The binary maintains independent state per session.
5. Tests interact via the wire protocol: Interact messages produce
   events, which flow through the app's runtime.
6. State changes trigger view -> diff -> Patch back to the binary.
7. Tests query the binary's tree (Query message) and the local model.
8. Sessions are Reset between tests.

This architecture means tests exercise the real wire protocol, real
encoding, and real diffing -- the same code paths as production.


## Snapshots and screenshots

### Structural tree hashes (`assertTreeHash`)

`assertTreeHash()` captures a SHA-256 hash of the serialized UI tree
and compares it against a golden file. It works on all three backends
because every backend can produce a tree.

```typescript
test('counter initial state', async ({ session }) => {
  await session.assertTreeHash('counter-initial')
})

test('counter after increment', async ({ session }) => {
  await session.click('increment')
  await session.assertTreeHash('counter-at-1')
})
```

Golden files are stored in `test/golden/` as `.sha256` files. On first
run, the golden file is created automatically. On subsequent runs, the
hash is compared and the test fails on mismatch.

### Pixel screenshots (`assertScreenshot`)

`assertScreenshot()` captures real RGBA pixel data and compares it
against a golden file. It produces meaningful data on the `:windowed`
backend (GPU rendering via wgpu) and the `:headless` backend (software
rendering via tiny-skia). On `:mock`, it silently succeeds as a no-op.

Note that headless screenshots use software rendering, so pixels will
not match GPU output exactly. Maintain separate golden files per
backend, or use headless screenshots for layout regression testing only.

```typescript
test('counter renders correctly', async ({ session }) => {
  await session.click('increment')
  await session.assertScreenshot('counter-at-1')
})
```

Golden files are stored in `test/screenshots/`. The workflow is the
same as structural snapshots.

Because screenshots silently no-op on mock, you can include
`assertScreenshot` calls in any test without conditional logic. They
produce assertions when run on the headless or windowed backends.

### When to use each

- **`assertTreeHash`** -- always appropriate. Catches structural
  regressions (widgets appearing/disappearing, prop changes, nesting
  changes). Works on every backend. Use liberally.

- **`assertScreenshot`** -- after bumping iced, changing the renderer,
  modifying themes, or any change that affects visual output. Only
  meaningful on the headless and windowed backends.


## Script-based testing

`.plushie` scripts provide a declarative format for describing
interaction sequences. The format is a superset of iced's `.ice` test
scripts -- the core instructions (`click`, `type`, `expect`,
`snapshot`) use the same syntax. Plushie adds `assert_text`,
`assert_model`, `screenshot`, `wait`, and a header section for app
configuration.

### The `.plushie` format

A `.plushie` file has a header and an instruction section separated
by `-----`:

```
app: counter
viewport: 800x600
theme: dark
backend: mock
-----
click "increment"
click "increment"
expect "Count: 2"
tree_hash "counter-at-2"
screenshot "counter-pixels"
assert_text "count" "2"
wait 500
```

#### Header fields

| Field | Required | Default | Description |
|---|---|---|---|
| `app` | Yes | -- | App module to test |
| `viewport` | No | `800x600` | Viewport size as `WxH` |
| `theme` | No | `dark` | Theme name |
| `backend` | No | `mock` | Backend: `mock`, `headless`, or `windowed` |

Lines starting with `#` are comments (in both header and body sections).

#### Instructions

| Instruction | Syntax | Mock support | Description |
|---|---|---|---|
| `click` | `click "selector"` | Yes | Click a widget |
| `type` | `type "selector" "text"` | Yes | Type text into a widget |
| `type` (key) | `type enter` | Yes | Send a special key (press + release). Supports modifiers: `type ctrl+s` |
| `expect` | `expect "text"` | Yes | Assert text appears somewhere in the tree |
| `tree_hash` | `tree_hash "name"` | Yes | Capture and assert a structural tree hash |
| `screenshot` | `screenshot "name"` | No-op on mock | Capture and assert a pixel screenshot |
| `assert_text` | `assert_text "selector" "text"` | Yes | Assert widget has specific text |
| `assert_model` | `assert_model "expression"` | Yes | Assert expression appears in inspected model (substring match) |
| `press` | `press key` | Yes | Press a key down. Supports modifiers: `press ctrl+s` |
| `release` | `release key` | Yes | Release a key. Supports modifiers: `release ctrl+s` |
| `move` | `move "selector"` | No-op | Move mouse to a widget (requires widget bounds) |
| `move` (coords) | `move "x,y"` | Yes | Move mouse to pixel coordinates |
| `wait` | `wait 500` | Ignored (except replay) | Pause N milliseconds |

### Running scripts

```sh
npx plushie script                                # run all scripts in test/scripts/
npx plushie script test/scripts/counter.plushie   # run specific scripts
```

### Replaying scripts

```sh
npx plushie replay test/scripts/counter.plushie
```

Replay mode forces the windowed backend and respects `wait` timings,
so you see interactions happen in real time with real windows. Useful
for debugging visual issues, demos, and onboarding.


## Testing async workflows

### On the mock backend

The mock backend executes `async`, `stream`, and `done` commands
synchronously. When `update()` returns a command like
`Command.async(async () => fetchData(), 'dataLoaded')`, the backend
immediately calls the function, gets the result, and dispatches the
`AsyncEvent` through `update()` -- all within the same call.

This means `awaitAsync()` returns immediately (the work is already
done):

```typescript
test('fetching data loads results', async ({ session }) => {
  await session.click('fetch')
  // On mock, the async command already executed synchronously.
  // awaitAsync is a no-op -- the model is already updated.
  await session.awaitAsync('dataLoaded')
  expect(session.model().results.length).toBeGreaterThan(0)
})
```

Widget ops (focus, scroll), window ops, and timers are silently
skipped on mock because they require a renderer. Test the command
shape at the unit test level instead.


## Debugging and error messages

### Element not found

```typescript
await session.findOrThrow('nonexistent')
// Error: Element not found: "nonexistent"
```

Use `session.tree()` to inspect the current tree and verify the
widget's ID:

```typescript
console.log('current tree:', JSON.stringify(session.tree(), null, 2))
```

### Wrong interaction type

```
cannot click a checkbox widget -- use toggle() instead
```

Use the correct interaction function for the widget type. See the
[interaction table](#interactions).

### Inspecting state when a test fails

`model()` and `tree()` are your best debugging tools:

```typescript
test('debugging a failing test', async ({ session }) => {
  await session.click('increment')

  console.log('model after click:', session.model())
  console.log('tree after click:', JSON.stringify(session.tree(), null, 2))

  await session.assertText('count', '1')
})
```


## CI configuration

### Mock CI (simplest)

No special setup. Works anywhere Node.js runs.

```yaml
- run: npx plushie download
- run: pnpm test
```

### Headless CI

Requires the plushie binary (download or build from source).

```yaml
- run: npx plushie download
- run: PLUSHIE_TEST_BACKEND=headless pnpm test
```

### Windowed CI

Requires a display server and GPU/software rendering. Two options:

**Option A: Xvfb (X11)**

```yaml
- run: npx plushie download
- run: sudo apt-get install -y xvfb mesa-vulkan-drivers
- run: |
    Xvfb :99 -screen 0 1024x768x24 &
    export DISPLAY=:99
    export WINIT_UNIX_BACKEND=x11
    PLUSHIE_TEST_BACKEND=windowed pnpm test
```

**Option B: Weston (Wayland)**

Weston's headless backend provides a Wayland compositor without a
physical display. Combined with `vulkan-swrast` (Mesa software
rasterizer), this runs the full rendering pipeline on CPU.

```yaml
- run: npx plushie download
- run: sudo apt-get install -y weston mesa-vulkan-drivers
- run: |
    export XDG_RUNTIME_DIR=/tmp/plushie-xdg-runtime
    mkdir -p "$XDG_RUNTIME_DIR" && chmod 0700 "$XDG_RUNTIME_DIR"
    weston --backend=headless --width=1024 --height=768 --socket=plushie-test &
    sleep 1
    export WAYLAND_DISPLAY=plushie-test
    PLUSHIE_TEST_BACKEND=windowed pnpm test
```

### Progressive CI

Run mock tests fast, then promote to higher-fidelity backends:

```yaml
# All tests on mock (fast, catches logic bugs)
- run: pnpm test

# Full suite on headless for protocol verification
- run: PLUSHIE_TEST_BACKEND=headless pnpm test

# Windowed for pixel regression (tagged subset)
- run: |
    Xvfb :99 -screen 0 1024x768x24 &
    export DISPLAY=:99
    PLUSHIE_TEST_BACKEND=windowed pnpm test -- --grep @windowed
```


## Known limitations

Workarounds and details for each limitation are noted inline below.

- Script instruction `move` (move cursor to a widget by selector) is
  a no-op. It requires widget bounds from layout, which only the
  renderer knows.
- `moveTo` on the mock backend dispatches a mouse moved event but has
  no spatial layout info. Mouse area enter/exit events will not fire.
- Pixel screenshots are only available on the headless and windowed
  backends (mock returns stubs).
- Headless screenshots use software rendering (tiny-skia) and may not
  match GPU output pixel-for-pixel.
- Script `assert_model` uses substring matching against the inspected
  model. Use specific substrings or use vitest assertions for precise
  model checks.
- Async/stream/batch commands are executed synchronously in all test
  backends. Timing and concurrency bugs will not surface in mock tests.
  Use headless or windowed backends for concurrency-sensitive tests.
- Headless and windowed backends spawn a renderer via a child process.
  If a test crashes without proper cleanup, the BEAM process exit
  propagation kills the port.

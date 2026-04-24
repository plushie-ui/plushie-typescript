# Testing

Plushie tests run against the real `plushie` renderer binary
through a multiplexed session pool. The testing module lives at
`plushie/testing`; its `testWith` helper wraps Vitest so each test
gets a fresh `TestSession` while sharing one renderer subprocess
across the whole suite.

```typescript
import { testWith } from "plushie/testing"
import { expect } from "vitest"
import counter from "./counter.js"

const test = testWith(counter)

test("increments on click", async ({ session }) => {
  await session.click("increment")
  expect(session.model().count).toBe(1)
  await session.assertText("count", "Count: 1")
})
```

There are no TypeScript-side mocks. The binary in `mock` mode is
sub-millisecond per interaction, runs the real wire protocol, and
provides per-session state isolation. Any test that passes against
a pure-TS substitute but fails against the real binary would hide
bugs at the SDK / renderer boundary; the framework removes that
class of mistake.

## Setup

Tests run under Vitest. The package already declares
`vitest` as a dev dependency and ships a minimal
`vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
  },
})
```

The `plushie` binary must exist on disk before tests run. Install
or download it via the CLI; see
[CLI commands reference](cli-commands.md#download).

```bash
pnpm exec plushie download    # precompiled binary for the pinned version
pnpm test                     # default: mock backend
```

If the binary cannot be resolved, `resolveBinary()` throws before
the pool starts and the first `testWith` call fails immediately.

## `testWith(appDef, opts?)`

```typescript
function testWith<M>(
  appDef: AppDefinition<M>,
  opts?: TestOptions,
): (name: string, fn: (ctx: { session: TestSession<M> }) => Promise<void>) => void
```

`testWith` returns a Vitest-compatible test function. Each
invocation creates a fresh `TestSession<M>` backed by a pooled
renderer slot, runs the body, then stops the session. Failures in
the body propagate to Vitest unchanged.

`TestOptions` fields:

| Option | Type | Description |
|---|---|---|
| `binary` | `string` | Path to the `plushie` binary. Defaults to `resolveBinary()`. |
| `mode` | `"mock" \| "headless"` | Renderer mode. Defaults to `"mock"`. |
| `format` | `"msgpack" \| "json"` | Wire format. Defaults to `"msgpack"`. |
| `maxSessions` | `number` | Maximum concurrent sessions in the pool. Defaults to `8`. |

All options apply to the global pool. The first `testWith` call
creates it; later calls reuse the existing pool. Changing `binary`,
`mode`, or `format` across `testWith` calls has no effect once the
pool is running. Set them consistently at the top of a test module
or in `globalSetup`.

`createSession(appDef, opts?)` is the lower-level primitive
`testWith` calls internally. Use it when you need a session outside
the Vitest `test` callback (for instance in `beforeAll`):

```typescript
import { createSession, stopPool } from "plushie/testing"
import { afterAll, beforeAll } from "vitest"

let session: TestSession<Model>
beforeAll(async () => { session = await createSession(myApp) })
afterAll(() => { session.stop(); stopPool() })
```

`stopPool()` shuts down the shared renderer. Call it from
`globalTeardown` if your runner does not kill the Vitest worker
between runs.

## Backends

| Backend | Rendering | Screenshots | Typical cost |
|---|---|---|---|
| `mock` | Protocol only, no GPU | Stubbed (hash always present, pixels null) | Sub-ms per interaction |
| `headless` | Software pipeline | Real pixel data | Tens of ms per interaction |

The testing module accepts `mode: "mock"` or `mode: "headless"` in
`TestOptions`. The `plushie script` runner recognises a third
`windowed` mode; the Vitest harness does not.

Select `headless` per-test by passing the option through:

```typescript
const test = testWith(myApp, { mode: "headless" })
```

For whole-suite selection, the package exposes a
`PLUSHIE_TEST_BACKEND` contract in `CONTRIBUTING.md`. The SDK does
not read this variable automatically; wire it up in a local setup
file:

```typescript
// test/setup.ts
import { testWith as _testWith } from "plushie/testing"
import type { AppDefinition } from "plushie"

const mode = process.env.PLUSHIE_TEST_BACKEND === "headless" ? "headless" : "mock"
export const testWith = <M>(app: AppDefinition<M>) => _testWith(app, { mode })
```

Then:

```bash
PLUSHIE_TEST_BACKEND=headless pnpm test
```

`headless` requires no display server but does need the binary
built with the headless feature (see
[CLI commands reference](cli-commands.md#build)).

## `TestSession` API

`TestSession<M>` wraps a `Runtime<M>` connected to a pooled
renderer slot. Every interaction round-trips through the real
binary and processes the resulting events through the runtime
before resolving, so `session.model()` always reflects the effect
of the last awaited call.

### Interactions

All of these return `Promise<void>` and resolve after the renderer
has processed the interaction and the runtime has applied the
resulting events.

| Method | Signature | Description |
|---|---|---|
| `click` | `(selector)` | Click a widget. |
| `typeText` | `(selector, text)` | Type text into a text input or editor. |
| `submit` | `(selector)` | Submit a text input (press Enter). |
| `toggle` | `(selector)` | Toggle a checkbox or toggler. |
| `select` | `(selector, value)` | Select a value from a pick list, combo box, or radio group. |
| `slide` | `(selector, value)` | Set a slider value. |
| `press` | `(key)` | Press a key (key down only). |
| `release` | `(key)` | Release a key (key up only). |
| `typeKey` | `(key)` | Press and release a key. |
| `moveTo` | `(x, y)` | Move the cursor to window coordinates. |
| `scroll` | `(selector, deltaX, deltaY)` | Scroll a scrollable widget. |
| `paste` | `(selector, text)` | Paste text into a widget. |
| `sort` | `(selector, column, direction?)` | Sort a table column. |
| `canvasPress` | `(selector, x, y, button?)` | Press on a canvas at local coordinates. |
| `canvasRelease` | `(selector, x, y, button?)` | Release on a canvas at local coordinates. |
| `canvasMove` | `(selector, x, y)` | Move within a canvas. |
| `paneFocusCycle` | `(selector)` | Cycle focus within a pane grid. |

Key names for `press`, `release`, and `typeKey` go through
`resolveKey()` from `plushie`; case and separators are normalised.
Modifier combinations use `+`: `"Ctrl+s"`, `"Shift+Left"`,
`"Alt+F4"`.

### Queries

Selectors are a unified string syntax parsed inside the session:

| Form | Matches |
|---|---|
| `"id"` / `"path/to/id"` | Widget ID (scoped or local). |
| `"#path/to/id"` | Same, with explicit `#` prefix. |
| `"window#path/to/id"` | Window-qualified ID. |
| `":focused"` | Currently focused widget. |
| `"window#:focused"` | Focused widget in a named window. |
| `"[text=Save]"` | Widget whose text, label, or value matches. |
| `"[role=button]"` | Widget with the given accessibility role. |
| `"[label=Email]"` | Widget with the given accessibility label. |

Local IDs are resolved against the rendered tree. If a local ID
exists in a single window, the session picks it. If it exists in
more than one window without a qualifier, interactions throw so
tests are forced to disambiguate.

| Method | Signature | Description |
|---|---|---|
| `find` | `(selector)` | Return the matching `Element` or `null`. |
| `findOrThrow` | `(selector)` | Return the matching `Element`; throw if missing. |
| `findByText` | `(text)` | Find by displayed text, label, or value. |
| `findByRole` | `(role)` | Find by accessibility role. |
| `findByLabel` | `(label)` | Find by accessibility label. |
| `findFocused` | `()` | Return the focused `Element`, or `null`. |
| `queryTree` | `()` | Return the full renderer-side tree as an `Element`. |

`Element` carries `id`, `type`, `props`, `children`, and a
convenience `text` field extracted from `props.content`,
`props.label`, `props.value`, or `props.placeholder`.

### State inspection

| Method | Signature | Description |
|---|---|---|
| `model` | `()` | Current model as `DeepReadonly<M>`. |
| `tree` | `()` | Last normalised wire tree, or `null` if not yet rendered. |
| `getDiagnostics` | `()` | Accumulated prop validation diagnostics; clears on read. |
| `reset` | `()` | Re-run `init` and re-render without restarting the renderer. |

### Assertions

These throw `Error` on mismatch, so they compose with Vitest
without wrapping:

| Method | Signature | Description |
|---|---|---|
| `assertText` | `(selector, expected)` | Widget's text matches `expected`. |
| `assertExists` | `(selector)` | A widget matches the selector. |
| `assertNotExists` | `(selector)` | No widget matches the selector. |
| `assertRole` | `(selector, role)` | Widget's resolved a11y role matches. |
| `assertA11y` | `(selector, expected)` | Subset of resolved a11y props matches. |
| `assertModel` | `(expected)` | Model JSON-equals `expected`. |
| `resolvedA11y` | `(selector)` | Returns the resolved a11y map (placeholder / alt inferred). |

Mix session assertions with Vitest `expect` freely:

```typescript
test("saves draft", async ({ session }) => {
  await session.typeText("editor", "hello")
  await session.click("save")
  expect(session.model().savedCount).toBe(1)
  await session.assertText("status", "Saved")
})
```

### Timers, async, and effect stubs

| Method | Signature | Description |
|---|---|---|
| `timer` | `(tag)` | Inject a synthetic `TimerEvent` with the given tag. |
| `awaitAsync` | `(tag, timeout?)` | Resolve with the next `AsyncEvent` matching `tag`; rejects after `timeout` ms (default `5000`). |
| `registerEffectStub` | `(kind, response)` | Register a deterministic response for an effect kind. |
| `unregisterEffectStub` | `(kind)` | Remove a previously registered stub. |

Stubs register by effect kind (`"file_open"`, `"clipboard_write"`,
`"notification"`, etc.), not by tag, so a single stub covers every
call site that issues that effect during the test.

```typescript
test("opens a file via dialog", async ({ session }) => {
  await session.registerEffectStub("file_open", {
    kind: "file_opened",
    path: "/tmp/input.txt",
    content: "hello",
  })
  await session.click("open")
  expect(session.model().fileName).toBe("input.txt")
})
```

`awaitAsync` is useful when a command fires without an obvious UI
trigger, for example from `init`:

```typescript
test("loads initial data", async ({ session }) => {
  const event = await session.awaitAsync("initial-load")
  expect(event.result.ok).toBe(true)
})
```

### Golden snapshots

| Method | Signature | Description |
|---|---|---|
| `treeHash` | `(name)` | Request a SHA-256 hash of the current tree. |
| `screenshot` | `(name, opts?)` | Request a screenshot; returns `{ hash, width, height, rgba }`. |
| `assertTreeHash` | `(name)` | Compare `treeHash` against `test/golden/<name>.<mode>.sha256`. |
| `assertScreenshot` | `(name)` | Compare `screenshot.hash` against `test/screenshots/<name>.json`. |
| `saveScreenshot` | `(name, opts?)` | Persist the screenshot as `.rgba` plus a JSON sidecar. |

Golden files live next to the test suite:

```
test/
  golden/
    counter-initial.mock.sha256
    counter-after-click.mock.sha256
  screenshots/
    login-form.json
    login-form.rgba
```

The file suffix encodes the backend (`.mock.sha256`,
`.headless.sha256`) so the same test can carry separate goldens for
protocol-level and pixel-level assertions. On first run both
`assertTreeHash` and `assertScreenshot` throw unless
`PLUSHIE_UPDATE_SNAPSHOTS=1` is set, which writes the golden and
resolves successfully:

```bash
PLUSHIE_UPDATE_SNAPSHOTS=1 pnpm test
```

In `mock` mode, `screenshot` returns a stubbed `rgba` of `null` but
still produces a deterministic `hash`. `assertScreenshot` therefore
compares only the hash; it works in both modes, but the pixel
payload is only meaningful under `headless`.

## Animation testing

Renderer-side transitions (`transition`, `spring`, `sequence` from
`plushie/animation`) resolve instantly in `mock` mode: props snap
straight to their target values. For step-controlled animation
tests under `headless`, dispatch `Command.advanceFrame(timestamp)`
from `update`:

```typescript
import { Command } from "plushie"

function update(state: Model, event: Event): [Model, Command] {
  if (isClick(event, "step")) {
    return [state, Command.advanceFrame(state.clock + 16)]
  }
  return [state, Command.none()]
}
```

Each call advances the renderer animation clock to `timestamp`.
Combine with `assertTreeHash` to lock down intermediate frames
deterministically.

## Session pool

`testWith` and `createSession` share a single
`SessionPool` per Node process. The pool spawns the binary with
`--max-sessions N` and multiplexes sessions over its stdio. Each
session has its own ID; the renderer routes inbound and outbound
messages by session ID, giving full state isolation.

The first session registration also starts the process. Subsequent
sessions reuse it. When a session stops, the pool sends a `Reset`
message, awaits the `reset_response`, and reclaims the slot. If
the renderer fails to respond within five seconds, the slot is
dropped anyway so a misbehaving test cannot wedge the pool.

`stopPool()` terminates the process. Vitest workers exit between
runs, so explicit teardown is usually unnecessary; add it when a
parent process needs to reclaim the subprocess eagerly.

## `.plushie` script runner

The SDK ships a text-based script format for declarative
interaction tests. Scripts live in `src/script.ts` and run through
any `Session` (not `TestSession`): use the CLI wrapper
`plushie script` (see
[CLI commands reference](cli-commands.md#script)) or drive one
inline.

```
app: MyApp
viewport: 800x600
theme: dark
backend: mock
-----
click "#save"
type_text "#editor" "Hello"
expect "Hello"
tree_hash "after-hello"
```

Header fields: `app:`, `viewport:` (`WxH`), `theme:`, `backend:`
(`mock`, `headless`, `windowed`).

Instructions:

| Instruction | Description |
|---|---|
| `click SELECTOR` | Click a widget. |
| `type_text SELECTOR TEXT` | Type into a widget. |
| `type_key KEY` | Press and release a key. |
| `press KEY` / `release KEY` | Key down / key up. |
| `move_to X Y` | Move the cursor. |
| `toggle SELECTOR` | Toggle a checkbox. |
| `select SELECTOR VALUE` | Select from a list. |
| `slide SELECTOR VALUE` | Move a slider. |
| `expect TEXT` | Assert text appears anywhere in the tree. |
| `assert_text SELECTOR TEXT` | Assert a specific widget's text. |
| `tree_hash NAME` / `screenshot NAME` | Capture goldens. |
| `wait MS` | Pause. |

```typescript
import { parseScriptFile, runScript } from "plushie/script"

const script = parseScriptFile("test/scripts/login.plushie")
const result = await runScript(script, session)
if (!result.passed) throw new Error(result.failures.join("\n"))
```

`runScript` returns `{ passed, failures }`; each failure is a
string of the form `"instruction: reason"`.

## See also

- [Commands reference](commands.md) - `Command.task`, `Command.advanceFrame`, `Command.treeHash`.
- [Events reference](events.md) - event shapes returned to `update`.
- [App lifecycle reference](app-lifecycle.md) - `init`, `update`, and `run()` semantics.
- [CLI commands reference](cli-commands.md) - downloading the binary and running scripts.
- [Accessibility reference](accessibility.md) - roles and labels that `assertA11y` asserts on.

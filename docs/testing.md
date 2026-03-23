# Testing

## Philosophy

Progressive fidelity: test your app's logic with fast unit tests;
promote to full integration tests with the real renderer when you
need wire-protocol verification or pixel-accurate screenshots.

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
  // result is [newModel, command]
  const [model, cmd] = result as [Model, Command]

  expect(model.todos[0].text).toBe('Buy milk')
  expect(cmd.type).toBe('focus')
  expect(cmd.payload).toEqual({ target: 'app/newTodo' })
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
destroys a test session for each test. Sessions are backed by a
shared binary process with multiplexed sessions for isolation.

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

## Test helpers

### Interactions

Each sends an Interact wire message to the renderer and processes
the response events through the app's runtime:

```typescript
await session.click('buttonId')
await session.typeText('inputId', 'hello')
await session.submit('inputId')
await session.toggle('checkboxId')
await session.select('pickListId', 'option')
await session.slide('sliderId', 75)
await session.press('ctrl+s')
await session.release('s')
await session.typeKey('Enter')
await session.moveTo(100, 200)
await session.scroll('scrollableId', 0, 50)
await session.paste('inputId', 'pasted text')
await session.sort('tableId', 'columnKey')
await session.canvasPress('canvasId', 50, 100)
await session.canvasRelease('canvasId', 50, 100)
await session.canvasMove('canvasId', 75, 125)
await session.paneFocusCycle('paneGridId')
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

### Golden files

```typescript
const hash = await session.treeHash('afterClick')
await session.assertTreeHash('afterClick')   // compare to saved
await session.assertScreenshot('homepage')    // pixel comparison
await session.saveScreenshot('homepage')      // save for first time
```

Golden files are stored in `test/golden/` (tree hashes) and
`test/screenshots/` (pixel data). On first run, the value is saved.
On subsequent runs, it's compared. Delete the golden file to reset.

### Lifecycle

```typescript
session.reset()  // re-initialize the app to initial state
session.stop()   // close the session
```

## Three backends

| Backend | Speed | Rendering | Display needed |
|---|---|---|---|
| mock (default) | ~ms | None | No |
| headless | ~100ms | Real (tiny-skia) | No |
| windowed | ~seconds | Real (GPU) | Yes (or Xvfb) |

Select via environment variable:

```sh
pnpm test                                  # mock (default)
PLUSHIE_TEST_BACKEND=headless pnpm test    # real rendering
PLUSHIE_TEST_BACKEND=windowed pnpm test    # real windows
```

Tests are backend-agnostic -- the same test code works at all three
fidelity levels.

## Tips

- **Test handlers directly** for logic. Use integration tests for
  interaction flows and visual regression.
- **Mock mode is fast enough** for hundreds of tests. Don't
  default to headless unless you need screenshots.
- **Golden files** catch regressions. Commit them to version control.
- **Scoped IDs** work in test selectors: `session.click('form/save')`.

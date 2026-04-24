# Commands

Commands describe side effects returned from an inline handler or
`update`. The runtime executes them; handlers never run side
effects directly.

```typescript
import { Command } from "plushie"

function update(state: Model, event: Event): [Model, Command] {
  if (isClick(event, "save")) {
    return [{ ...state, saving: true }, Command.task(persist, "save")]
  }
  if (isClick(event, "quit")) {
    return [state, Command.exit()]
  }
  return [state, Command.none()]
}
```

`Command` is a namespace of constructor functions exported from
`plushie`. The type of the returned value is `CommandType`,
re-exported from `plushie` as well:

```typescript
import type { CommandType } from "plushie"

const noop: CommandType = Command.none()
```

Most handler signatures can infer the type, so explicit
annotations are rare. Commands are immutable frozen objects; do
not construct them by hand.

## Control flow

| Function | Signature | Description |
|---|---|---|
| `Command.none` | `()` | No-op. Returned when `update` makes no request. |
| `Command.batch` | `(commands: Command[])` | Execute commands sequentially in order. |
| `Command.exit` | `()` | Quit the application; shuts down the runtime and renderer. |

`batch` threads state through each command: successive commands
see the effects of earlier ones (for example, cursor moves apply
before a follow-up scroll).

```typescript
Command.batch([
  Command.focus("name"),
  Command.selectAll("name"),
])
```

## Async tasks and streams

Long-running or IO work lives in tasks. The runtime creates an
`AbortController` for each task; the signal enables cooperative
cancellation.

| Function | Signature | Description |
|---|---|---|
| `Command.task` | `(fn: (signal: AbortSignal) => Promise<unknown>, tag: string)` | Run an async function; result arrives as `AsyncEvent`. |
| `Command.stream` | `(fn: (signal: AbortSignal) => AsyncIterable<unknown>, tag: string)` | Run an async generator; yielded values arrive as `StreamEvent`, final return as `AsyncEvent`. |
| `Command.cancel` | `(tag: string)` | Cancel a running task or stream by tag. |
| `Command.sendAfter` | `(delayMs: number, event: unknown)` | Dispatch `event` through `update` after a delay. |

Only one task per tag can be active. Dispatching a new task with
an existing tag cancels the previous one and replaces it.

```typescript
Command.task(async (signal) => {
  const res = await fetch("/api/items", { signal })
  if (!res.ok) throw new Error(`status ${res.status}`)
  return res.json()
}, "items")
```

Stream example: incremental log tailing.

```typescript
Command.stream(async function* (signal) {
  const res = await fetch("/logs", { signal })
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  while (true) {
    const { done, value } = await reader.read()
    if (done) return
    yield decoder.decode(value)
  }
}, "logs")
```

Values land in `update` as `StreamEvent` for each yield and one
`AsyncEvent` at the end. Narrow with `isStream(event, "logs")` and
`isAsync(event, "logs")`. See [Events](events.md).

`sendAfter` is a one-shot timer:

```typescript
Command.sendAfter(2000, { kind: "timer", tag: "toast_gone", timestamp: Date.now() })
```

Dispatching another `sendAfter` with the same event replaces any
pending one, so no duplicate delivery.

## Focus

| Function | Signature | Description |
|---|---|---|
| `Command.focus` | `(widgetId: string)` | Give focus to a widget. |
| `Command.focusNext` | `()` | Move focus to the next focusable widget. |
| `Command.focusPrevious` | `()` | Move focus to the previous focusable widget. |
| `Command.focusNextWithin` | `(scope: string)` | Cycle focus forward, bounded to a subtree. |
| `Command.focusPreviousWithin` | `(scope: string)` | Cycle focus backward, bounded to a subtree. |
| `Command.selectAll` | `(widgetId: string)` | Select all text in an input. |
| `Command.findFocused` | `(tag: string)` | Query which widget has focus; reply arrives as a tagged event. |

`focus` and `selectAll` accept scoped paths in `"window#path/id"`
form. See [Scoped IDs](scoped-ids.md).

`focusNextWithin` / `focusPreviousWithin` keep the Tab cycle
bounded to the subtree rooted at `scope`. Useful for menus, pane
grids, and other keyboard containers that should not leak focus
to siblings.

```typescript
// Ctrl+Tab cycles within a pane's contents
if (isKey(event, "press") && event.key === "Tab" && event.modifiers.ctrl) {
  return [state, Command.focusNextWithin("pane_grid")]
}
```

## Accessibility

| Function | Signature | Description |
|---|---|---|
| `Command.announce` | `(text: string, politeness?: "polite" \| "assertive")` | Screen reader announcement. Defaults to `"polite"`. |

```typescript
Command.announce(`Saved ${count} items`)
Command.announce("Connection lost", "assertive")
```

Use `"assertive"` sparingly; it interrupts the user's current
announcement.

## Scrolling

| Function | Signature | Description |
|---|---|---|
| `Command.scrollTo` | `(widgetId, offsetX, offsetY)` | Scroll to an absolute offset. |
| `Command.scrollBy` | `(widgetId, x, y)` | Scroll by a relative amount. |
| `Command.snapTo` | `(widgetId, x, y)` | Snap to a relative position (`0.0`-`1.0`). |
| `Command.snapToEnd` | `(widgetId)` | Snap to the end of content. |

All scroll commands accept the scoped `"window#path/id"` form.

## Text editing

| Function | Signature | Description |
|---|---|---|
| `Command.moveCursorToFront` | `(widgetId)` | Move cursor to text start. |
| `Command.moveCursorToEnd` | `(widgetId)` | Move cursor to text end. |
| `Command.moveCursorTo` | `(widgetId, position)` | Move cursor to byte position. |
| `Command.selectRange` | `(widgetId, startPos, endPos)` | Select a byte range. |

`position` is a byte offset, not a character count. Multibyte
UTF-8 characters span multiple bytes.

## Images

In-memory image handles let the app render images created at
runtime (for example, from a fetched buffer). Referenced by an
image widget via `src={{ handle: "avatar" }}`.

| Function | Signature | Description |
|---|---|---|
| `Command.createImage` | `(handle, data: Uint8Array)` | Register encoded PNG/JPEG bytes. |
| `Command.createImageRgba` | `(handle, width, height, pixels: Uint8Array)` | Register raw RGBA pixels. |
| `Command.updateImage` | `(handle, data: Uint8Array)` | Replace PNG/JPEG content. |
| `Command.updateImageRgba` | `(handle, width, height, pixels: Uint8Array)` | Replace RGBA pixel content. |
| `Command.deleteImage` | `(handle)` | Remove a handle. |
| `Command.listImages` | `(tag)` | Query registered handles; reply arrives as a tagged event. |
| `Command.clearImages` | `()` | Remove every handle. |

Image payloads ride a single wire message and block other traffic
until transferred. Prefer file-path image loading when the image
is on disk.

## Windows

| Function | Signature | Description |
|---|---|---|
| `Command.closeWindow` | `(windowId)` | Close a window. |
| `Command.focusWindow` | `(windowId)` | Give focus to a window. |
| `Command.resizeWindow` | `(windowId, width, height)` | Resize. |
| `Command.moveWindow` | `(windowId, x, y)` | Move. |
| `Command.maximizeWindow` | `(windowId, maximized?)` | Maximize or restore (default `true`). |
| `Command.minimizeWindow` | `(windowId, minimized?)` | Minimize or restore. |
| `Command.toggleMaximize` | `(windowId)` | Toggle maximize. |
| `Command.toggleDecorations` | `(windowId)` | Show or hide title bar and borders. |
| `Command.setWindowMode` | `(windowId, mode)` | `"windowed"`, `"fullscreen"`, `"hidden"`. |
| `Command.setWindowLevel` | `(windowId, level)` | `"normal"`, `"always_on_top"`, `"always_on_bottom"`. |
| `Command.dragWindow` | `(windowId)` | Begin a user-driven drag. |
| `Command.dragResizeWindow` | `(windowId, direction)` | Begin a user-driven resize from an edge/corner. |
| `Command.requestAttention` | `(windowId, urgency?)` | `"informational"` or `"critical"`. |
| `Command.setResizable` | `(windowId, resizable)` | Toggle user-driven resize. |
| `Command.setMinSize` | `(windowId, width, height)` | Minimum size constraint. |
| `Command.setMaxSize` | `(windowId, width, height)` | Maximum size constraint. |
| `Command.setResizeIncrements` | `(windowId, width \| null, height \| null)` | Step sizes for drag-resize. |
| `Command.setIcon` | `(windowId, rgba, width, height)` | Set the window icon from RGBA pixels. |
| `Command.enableMousePassthrough` | `(windowId)` | Pass clicks through to windows below. |
| `Command.disableMousePassthrough` | `(windowId)` | Reverse the above. |
| `Command.showSystemMenu` | `(windowId)` | Display the platform's window menu. |
| `Command.screenshotWindow` | `(windowId, tag)` | Capture the window; result arrives tagged. |
| `Command.allowAutomaticTabbing` | `(enabled)` | macOS window tabbing control. |

For the view-vs-command split (which changes go through
`view()`-level window descriptors and which go through imperative
commands), see [Windows and Layout](windows-and-layout.md).

## Window and system queries

Query commands deliver replies back as tagged events; match on the
tag to receive the answer.

| Function | Signature | Reply |
|---|---|---|
| `Command.windowSize` | `(windowId, tag)` | `{ width, height }` |
| `Command.windowPosition` | `(windowId, tag)` | `{ x, y }` |
| `Command.windowMode` | `(windowId, tag)` | window mode string |
| `Command.isMaximized` | `(windowId, tag)` | `boolean` |
| `Command.isMinimized` | `(windowId, tag)` | `boolean` |
| `Command.scaleFactor` | `(windowId, tag)` | DPI scale number |
| `Command.rawId` | `(windowId, tag)` | platform window ID |
| `Command.monitorSize` | `(windowId, tag)` | `{ width, height }` |
| `Command.systemTheme` | `(tag)` | `"light"` or `"dark"` |
| `Command.systemInfo` | `(tag)` | OS/CPU/memory/graphics record |

Replies arrive as `SystemEvent` or an effect-like event depending
on the query. Narrow with `isSystem(event, ...)` or the specific
tag match and read `event.value`.

## Panes

Pane commands target a `PaneGrid` widget by ID and an internal
pane by pane ID.

| Function | Signature | Description |
|---|---|---|
| `Command.paneSplit` | `(paneGridId, paneId, axis, newPaneId)` | Split a pane along an axis. |
| `Command.paneClose` | `(paneGridId, paneId)` | Close a pane. |
| `Command.paneSwap` | `(paneGridId, paneA, paneB)` | Swap two panes. |
| `Command.paneMaximize` | `(paneGridId, paneId)` | Maximize a pane. |
| `Command.paneRestore` | `(paneGridId)` | Restore the pane grid from maximized. |

`axis` is `"horizontal"` or `"vertical"`.

## Fonts and low-level widget operations

| Function | Signature | Description |
|---|---|---|
| `Command.loadFont` | `(family, data: Uint8Array)` | Load a font at runtime. |
| `Command.advanceFrame` | `(timestamp)` | Advance the animation clock (headless and test backends). |
| `Command.treeHash` | `(tag)` | Compute a SHA-256 hash of the renderer tree. |
| `Command.widgetCommand` | `(id, family, value?)` | Send a custom command to a widget by ID. |
| `Command.widgetBatch` | `(commands)` | Send many widget commands in one cycle. |
| `Command.dispatch` | `(value, mapper)` | Wrap a resolved value through a mapper and feed the result through `update`. |

`widgetCommand` and `widgetBatch` are the general-purpose escape
hatch used to target native widgets that define their own command
surface. See [Custom Widgets](custom-widgets.md) for how the `family`
and `value` fields are wired through a widget's own command dispatch.

## Tags

Most async commands (tasks, streams, queries, effects) accept a
`tag`. The tag ties the command to its response event; the runtime
validates that only the latest tag delivers to `update` (stale
results from cancelled tasks are discarded via an internal nonce).

Tags are plain strings. Name them after the operation they
represent, not after the data shape: `"save"`, `"fetch_items"`,
`"export_log"`. Two tags that refer to the same logical operation
must match exactly; typos silently drop results.

## Cancellation

`Command.task(fn, tag)` and `Command.stream(fn, tag)` pass an
`AbortSignal` to `fn`. Pass it through to async operations
(`fetch`, `setTimeout` via `AbortSignal.timeout`, ...) so they
abort when `Command.cancel(tag)` or a replacement dispatch hits.

```typescript
Command.task(async (signal) => {
  const res = await fetch("/slow", { signal })
  return res.json()
}, "slow")

// Later, in response to user action:
Command.cancel("slow")
```

Stale results (from aborted tasks) never reach `update`; they are
discarded at the runtime boundary.

## See also

- [Events reference](events.md)
- [Subscriptions reference](subscriptions.md)
- [Windows and Layout reference](windows-and-layout.md)
- [Scoped IDs reference](scoped-ids.md)
- [Custom Widgets reference](custom-widgets.md)

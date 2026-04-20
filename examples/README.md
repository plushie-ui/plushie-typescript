# Plushie Examples

Example apps demonstrating Plushie's features from minimal to complex.
Run any example with:

```sh
npx plushie run examples/<name>.ts
```

In dev mode, file watching is enabled. Edit an example while the GUI
is running and the window updates instantly, a good way to experiment
with the API:

```sh
npx plushie dev examples/<name>.ts
```

## API styles

The examples deliberately use different API patterns so you can compare:

- **Inline handlers**: `button("inc", "+", { onClick: increment })`
  Used by: Counter, Clock, ColorPicker. Handlers are pure functions
  `(state, event) => newState` defined outside the view.
- **update() fallback**: a single update function handling all events
  via type guards (`isClick`, `isTimer`, `isAsync`, etc.).
  Used by: RatePlushie, Shortcuts, AsyncFetch.
- **Hybrid**: inline handlers for widget events, update() for
  subscriptions and async results.
  Used by: Todo, Notes, Clock.
- **Custom widgets**: reusable `WidgetDef` components in `widgets/`.
  Used by: RatePlushie (StarRating, ThemeToggle), ColorPicker (ColorPickerWidget).

All styles are interchangeable. Pick whichever reads best for your
use case.

## Examples

### Counter

**File:** `counter.ts`

Minimal example. Two buttons increment and decrement a count.
Start here to understand `app()`, inline handlers, and the view tree.

```sh
npx plushie run examples/counter.ts
```

### Todo

**File:** `todo.ts`

Todo list with text input, checkboxes, filtering (all/active/done), and
delete. Demonstrates `textInput` with `onSubmit`, scoped IDs via
`container()` for dynamic lists, `Command.focus()` for refocusing after
submit, and view helper extraction.

```sh
npx plushie run examples/todo.ts
```

### Notes

**File:** `notes.ts`

Notes app combining state helpers: `Selection` (multi-select in list
view), `UndoStack` (undo/redo for editing), `Route` (stack-based
navigation between list and edit views), and `Data.query` (search
across note fields). Shows how to compose multiple state helpers in
a single model.

```sh
npx plushie run examples/notes.ts
```

### Clock

**File:** `clock.ts`

Displays the current time, updated every second. Demonstrates
`Subscription.every()` for timer-based subscriptions and
`isTimer()` in the update function.

```sh
npx plushie run examples/clock.ts
```

### Shortcuts

**File:** `shortcuts.ts`

Logs keyboard events to a scrollable list. Demonstrates
`Subscription.onKeyPress()` for global keyboard handling, modifier
key detection (Ctrl, Alt, Shift), and the `KeyEvent` type.

```sh
npx plushie run examples/shortcuts.ts
```

### AsyncFetch

**File:** `async_fetch.ts`

Button that triggers simulated background work. Demonstrates
`Command.task()` for running async functions off the main update
loop, `AbortSignal` for cancellation, and how async results are
delivered as `AsyncEvent` with `{ ok, value/error }` discrimination.

```sh
npx plushie run examples/async_fetch.ts
```

### ColorPicker

**File:** `color_picker.ts`

HSV color picker using a widget handler. The color picker widget
handles all interaction internally (mouse drag, keyboard adjustment,
focus tracking). The app receives semantic `:change` events with
the current HSV values.

```sh
npx plushie run examples/color_picker.ts
```

### RatePlushie

**Files:** `rate_plushie.ts`, `widgets/star_rating.ts`, `widgets/theme_toggle.ts`

App rating page with widget handler components composed into a styled
UI. Features a 5-star rating built from path-drawn star geometry and an
animated theme toggle that slides and rotates when "Dark humor" is
enabled. The entire page theme interpolates smoothly.

Demonstrates: widget handler extension system, semantic event emission,
form validation with per-field error state, accessible error wiring
(required, invalid, error_message), timer-based animation via
widget-scoped subscriptions, theme-aware rendering.

```sh
npx plushie run examples/rate_plushie.ts
```

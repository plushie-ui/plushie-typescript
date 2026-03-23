# Plushie Examples

Example apps demonstrating Plushie's features from minimal to complex.
Run any example with:

```sh
npx plushie run examples/<name>.ts
```

In dev mode, file watching is enabled. Edit an example while the GUI
is running and the window updates instantly -- a good way to experiment
with the API:

```sh
npx plushie dev examples/<name>.ts
```

## API styles

The examples deliberately use different API patterns so you can compare:

- **Inline handlers** -- `button("inc", "+", { onClick: increment })`
  Used by: Counter, Clock, ColorPicker. Handlers are pure functions
  `(state, event) => newState` defined outside the view.
- **update() fallback** -- a single update function handling all events
  via type guards (`isClick`, `isTimer`, `isAsync`, etc.).
  Used by: Catalog, RatePlushie, Shortcuts, AsyncFetch.
- **Hybrid** -- inline handlers for widget events, update() for
  subscriptions and async results.
  Used by: Todo, Notes, Clock.
- **Canvas widget helpers** -- reusable canvas components in `widgets/`.
  Used by: RatePlushie (StarRating, ThemeToggle).

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
`Command.async()` for running async functions off the main update
loop, `AbortSignal` for cancellation, and how async results are
delivered as `AsyncEvent` with `{ ok, value/error }` discrimination.

```sh
npx plushie run examples/async_fetch.ts
```

### ColorPicker

**File:** `color_picker.ts`

HSV color picker using canvas widgets. A hue ring surrounds a
saturation/value square with drag interaction. Demonstrates canvas
layers, path commands, linear gradients, and coordinate-based canvas
events (press/move/release for continuous drag).

```sh
npx plushie run examples/color_picker.ts
```

### Catalog

**File:** `catalog.ts`

Comprehensive widget catalog exercising every widget type across four
tabbed sections:

- **Layout:** column, row, container, scrollable, stack, grid, pin,
  floating, responsive, keyed_column, themer, space
- **Input:** button, text_input, checkbox, toggler, radio, slider,
  vertical_slider, pick_list, combo_box, text_editor
- **Display:** text, rule, progress_bar, tooltip, image, svg,
  markdown, rich_text, canvas
- **Composite:** mouse_area, sensor, pane_grid, table, simulated tabs,
  modal, collapsible panel

Use this as a reference for widget props and event patterns.

```sh
npx plushie run examples/catalog.ts
```

### RatePlushie

**Files:** `rate_plushie.ts`, `widgets/star_rating.ts`, `widgets/theme_toggle.ts`

App rating page with custom canvas-drawn widgets composed into a styled
UI. Features a 5-star rating built from path-drawn star geometry and an
animated theme toggle that slides and rotates when "Dark humor" is
enabled. The entire page theme interpolates smoothly.

Demonstrates: custom canvas widgets as reusable modules, interactive
shapes, canvas transforms for rotation, timer-based animation via
subscriptions, theme-aware rendering, keyboard interaction.

```sh
npx plushie run examples/rate_plushie.ts
```

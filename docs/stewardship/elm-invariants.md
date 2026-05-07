# Elm-architecture invariants

The contract between user apps and the runtime. These invariants
hold across every plushie-typescript app; the runtime enforces them
and the test framework relies on them. Other host SDKs implement the
same shape (modulo language idiom); plushie-elixir is the canonical
reference per `posture.md`.

## The three callbacks

A Plushie app passes a config to `app(config)`:

- `init: M | readonly [M, Command | Command[]]` - the initial
  model, optionally with commands to dispatch (load initial data,
  configure UI). Evaluated once at startup.
- `update(state, event): UpdateResult<M>` - called for events that
  do not have an inline handler. Returns the next model,
  optionally with commands.
- `view(state): WindowNode | readonly WindowNode[] | null` -
  called after every update. Returns a window or list of windows.
  Pure function of model.

Optional fields: `subscriptions`, `settings`, `windowConfig`,
`requiredWidgets`, `handleRendererExit`. Defaults are sensible; the
two required pieces are `init` and `view`. `update` is required at
the type level so static-display apps return the model unchanged
(`return [state]` or just `return state`).

Handlers (inline `onClick`, `onSubmit`, etc. on JSX components or
builder props) are a TypeScript-native extension that compose with
the Elm fallback `update`:

```typescript
type Handler<S> = (state, event) =>
  S | readonly [S, Command | Command[]];
```

Handlers receive current state as the first argument (injected by
the runtime, not captured via closure), and return the same shape
as `update`. Events without an inline handler fall through to
`update`. Pure-Elm style (only `update`, no inline handlers) is
fully supported and stays in shape parity with the other SDKs.

## Return-shape validation

`init`, `update`, and inline handlers must return one of:

- A bare model (no side effects needed).
- A tuple `[model, command]` (single command).
- A tuple `[model, command[]]` (list of commands; can be empty).

The `UpdateResult<S>` type captures this at compile time. At
runtime, the runtime defends against the type system being bypassed
(e.g., a JS caller without TypeScript): a Promise returned from a
handler triggers a clear "use Command.async" error; a tuple of the
wrong arity surfaces a typed runtime error rather than corrupting
state silently.

There is no `[model, command, opts]` shape, no `{ noUpdate: true,
state }` shape, no implicit array-flatten, no shape that returns "no
change." A bare model is the no-change shape.

## Commands are pure data

A command is a frozen tagged object:

```typescript
interface Command {
  readonly [COMMAND]: true;
  readonly type: string;
  readonly payload: Readonly<Record<string, unknown>>;
}
```

The `COMMAND` symbol tag is `Symbol.for("plushie.command")`, used
for reliable detection across realm boundaries. The runtime
executes commands; user code never executes one directly. This is
what makes `update` and handlers testable without going through
I/O: the test asserts the command was returned; the runtime is what
would have run it.

Categories (`Command.*` constructors):

- Async work: `Command.async`, `Command.stream`, `Command.cancel`,
  `Command.done`.
- Widget operations: `Command.focus`, `Command.scroll`,
  `Command.select`, `Command.cursor`, `Command.widgetOp`.
- Window operations: `Command.closeWindow`, `Command.windowOp`,
  `Command.windowQuery`.
- Effects: `Command.effect` (file dialogs, clipboard,
  notifications).
- Lifecycle: `Command.sendAfter`, `Command.exit`, `Command.batch`.
- Native widget commands: `Command.widgetCommand`,
  `Command.widgetCommands`.
- Images: `Command.imageOp`.
- Animation: `Command.advanceFrame`.

A user dispatching a side effect that is not a command is a design
problem with the side effect, not a request for a new escape hatch.
If a needed side effect cannot be expressed as a command, the
missing command is the work.

## View is a pure function of model

`view` returns the UI tree from the model. It does not access
external state, does not call out to other modules with side
effects, does not perform I/O, does not read the network. The
runtime calls `view` after every update; it must be deterministic
from the model alone.

Pure-TS composite widgets defined via `WidgetDef`/`buildWidget` that
take internal state (the widget's `state` and `view`) are the
exception, but the state is owned by the runtime and threaded into
the widget's `view` deterministically; the widget body is still
pure with respect to the inputs it receives.

The top level of the view must be a window node, a list of window
nodes, or `null` (an app with no open windows). The runtime
enforces this; a bare `Column` or `Row` at the top level is an
error.

## Subscriptions are declarative

`subscriptions(state): Subscription[]` returns the list of active
subscriptions. The runtime diffs this list each cycle, starts new
subscriptions and stops removed ones. The user does not start or
stop subscriptions imperatively; they return the list and the
runtime reconciles.

Timer subscriptions run in the runtime process. Other subscriptions
(key, mouse, window events) are forwarded to the renderer as wire
messages. Subscription failures surface as events through the
normal dispatch path.

## Widget event flow

Events from the renderer arrive at the runtime, flow through widget
event interception, then reach inline handlers, then fall through
to `update`:

1. Wire event arrives from the renderer (e.g.,
   `{ family: "click", id: "increment" }`).
2. The runtime decodes it into a typed `Event`.
3. For widget events, the runtime walks the widget handler scope
   chain (innermost first) for handlers registered for this
   event family/id. Each widget's `handleEvent` returns one of:
   - `{ type: "ignored" }`: handler did not capture; continue to
     next.
   - `{ type: "consumed" }`: captured, no output; stop the chain.
   - `{ type: "update_state" }`: captured, internal state change
     only; stop.
   - `{ type: "emit", kind, value | data }`: captured, replace the
     event with a synthesized `WidgetEvent`; continue with the new
     event up the chain.
4. If the chain returns an event (or the original was not
   captured), the runtime looks up the inline handler registered
   for that widget id and event type during the last `view`.
5. If no inline handler is found, the event falls through to
   `update(state, event)`.
6. Non-widget events (timer, async, key, etc.) always go to
   `update`.

Canvas-internal events (`canvas_element_*`) that no handler captures
are auto-consumed by the runtime; they never reach `update`.
View-only widgets (no `state`, no `handleEvent`) are transparent;
events pass through.

This matches iced's captured/ignored model on the renderer side and
is part of the cross-SDK shape.

## Scoped IDs

Wire IDs use the canonical format `window#scope/path/id`:

- `"main#form/email"` - widget `email` inside scope `form` inside
  window `main`.
- `"main"` - the window itself.

Events on the runtime side carry split fields: `id` (local),
`scope` (reversed ancestor chain, immediate parent first),
`windowId` (window). This shape is what user pattern matching
operates on:

```typescript
function update(state, event) {
  if (isClick(event) && event.id === "save"
      && event.scope[0] === "form") { ... }
  if (isClick(event) && event.scope[0] === itemId) { ... }
}
```

Commands use forward-order path strings: `Command.focus("form/email")`.

Auto-ID containers (no explicit ID, ID generated by the runtime) do
not create a scope. Window nodes do not create a scope; they are
the window component of the wire ID. `/` is forbidden in
user-provided IDs; the runtime detects this and surfaces a clear
error explaining scoped IDs.

## What these invariants buy

- **Tests can be written.** A pure `update` plus pure data commands
  plus a pure `view` is exercisable through the integration spine
  without elaborate setup. The user never needs to "wait for an
  effect" in their tests; they assert on what was returned.
- **The runtime can revert on exception.** Because `update` and
  handlers are pure functions that return the new model, the
  runtime can keep the previous model and recover by reverting.
  Same for `view`: a previous tree is preserved and used as the
  fallback.
- **The transport can re-sync after a renderer crash.** The
  current model is enough to regenerate the full tree and
  re-establish state. The renderer holds no app state the runtime
  cannot reconstruct.
- **Cross-SDK parity is meaningful.** "What does plushie-elixir do
  here" has a precise answer; this SDK implements the same
  contract.

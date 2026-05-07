# Performance bar

plushie-typescript is meant to feel lightweight in use and
lightweight in the process listing. That is a baseline expectation,
not an optimization target chased after the fact.

The runtime sits between every event and every render. Work it does
on a hot path is paid by every interaction in every app. Idle apps
that draw CPU draw battery; runtimes that walk the tree six times
per update are felt on larger trees even when each walk profiles
cleanly. The whole point of going native through a typed wire is
that the host should feel lighter than what it replaces; a runtime
that pegs CPU loses that on its own merits.

## Working principle

Lightweight is achieved by not doing unnecessary work in the first
place. Optimizing a hot path after the fact is sometimes necessary;
far more of the win comes from never letting the work appear.

Each piece of work has a cost. Individually most of them are
cheap; the cost compounds across a frame, an interaction, an app's
lifetime, the user's battery. A tree walk that runs in 0.3ms looks
fine in isolation; six of them per update on a medium tree is
visible latency. Watch the compounding, not just the individual
microbenchmark.

The canonical example to keep in mind: the diff path's single-pass
`normalize` threading a `NormalizeContext` through one traversal
that accumulates widget handlers, scope chains, and metadata at
once, instead of multiple post-hoc walks. None of the alternative
walks would have flagged as a hotspot in a profile of a small app.
The consolidation was correct work because the redundant work was
unnecessary, the change made the code clearer rather than worse,
and the aggregate cost mattered for larger apps and edge cases.
That is the shape of performance work that earns its place without
a benchmark.

## Readability is the bound

Optimizations that obscure intent trade a forever cost (every
future reader) against a one-time benefit. Decline that trade by
default.

Worth doing without a benchmark because the win is obvious in
shape and readability is preserved or improved:

- Consolidating redundant traversals, dispatches, or serialization
  passes.
- Picking the right data structure for a known access pattern
  (Map by id over array scan; WeakMap when keying by object
  identity is genuinely the right shape).
- Avoiding a clearly unnecessary allocation, copy, or array-spread
  pass that another function on the same data already did.
- Localized refactors where the optimized form is also the cleaner
  form.
- Removing per-frame work that does not depend on per-frame inputs
  (move it to startup, to subscription diff, or to the edge where
  the input changes).

Need a benchmark, profile, or repro before they land, because the
readability cost is real:

- Clever encoding, lookup, or layout schemes that change how the
  code reads.
- Big-O claims of the form "this is O(n) on a hot path" without
  realistic N. Many such claims have N in the dozens, where the
  constant factor of `Map.get` or `Array.indexOf` over a small
  array is not the win the rewriter expects.
- Optimizations on idle or rarely-hit paths (startup, settings
  parsing, error paths, dev-mode overlays).
- Anything that asks the reader to look up a comment to understand
  what the code is doing.

Measurement is a tiebreaker for the second list, not a gate on the
first.

## TypeScript and V8 specifics

The runtime runs on V8 (Node, Chromium-based browsers). Recurring
considerations:

- **Hidden-class stability.** Object shape changes after creation
  trigger V8 to deopt accessors. The hot-path objects (events,
  commands, UINodes) are constructed with their full shape and
  frozen; later mutations would not work anyway because of
  `DeepReadonly`, but the V8 reason is also why this is the right
  shape.
- **Microtask vs macrotask.** Coalescing high-frequency events
  uses `queueMicrotask` so the flush runs before the next event
  loop tick. `setTimeout(fn, 0)` would run later, miss the natural
  batching window, and add a macrotask scheduling hop per flush.
- **Promise overhead is real but small.** A Promise allocation per
  async command is fine; a Promise allocation per pointer move is
  not. The hot event path is synchronous; async only enters where
  the user explicitly opted into it through `Command.async` or
  `Command.stream`.
- **`structuredClone` and `JSON.parse(JSON.stringify(...))` are
  not free.** Tree diffing operates on the existing object graph
  by reference comparison and shallow-equal where structural; it
  does not deep-copy. New tree material comes from the user's
  `view` function and is consumed by the diff; no intermediate
  clone.
- **`deepFreeze` is dev-only.** Production builds skip it because
  recursive freeze is O(model size) per update. The
  `DeepReadonly<M>` type carries the contract at compile time
  without the runtime cost.

## What lightweight looks like

Numeric direction for the realistic application profile (a few
hundred to about a thousand active tree nodes, dozens of images,
one to five fonts):

- **Frame budget.** 16.67ms (60fps) for a single update cycle
  end-to-end (event arrival, app `update`, `view`, tree diff, wire
  emit). Most of that budget belongs to the renderer; the SDK side
  should be a small slice.
- **Event-to-update.** Visible by the next frame.
  Sub-millisecond wire round-trip on a local pipe.
- **Idle CPU.** When nothing is happening, the runtime does no
  measurable work. No periodic polling, no animation tick when no
  animation is active, no spinning subscription threads, no
  per-frame walks when the tree has not changed.
- **Subscription cost.** Subscribing to a high-frequency source is
  the user's choice; the runtime applies coalescing
  (`defaultEventRate`, per-subscription `maxRate`) so the cost is
  bounded by what the user opts into.
- **Resident memory.** A few tens of MiB for the runtime in a
  small idle app. Memory grows with widget state and tree size,
  not with runtime bookkeeping. Internal caches (memo, widget view
  cache, normalize caches) bound their size.

These are direction, not contracts. There is no benchmark
infrastructure in the repo today; numbers should be tightened or
relaxed when measurement disagrees.

## Tree diff is the load-bearing piece

`src/tree/diff.ts` is the hot path that runs every cycle the view
tree changes. Worth preserving:

- Single-pass diff with LIS-based child reorder. The cost of an
  unnecessary full re-emit on a large tree is far worse than the
  cost of computing minimal moves.
- Memo-based skipping (`memo`) for expensive subtrees with stable
  cache keys.
- Per-widget view cache so deferred composite widgets do not
  re-render when neither props nor state changed.

Changes to the diff path that look like cleanups but actually
inflate work per node (extra Map lookups, redundant key
stringification, repeated property access where a destructure
would do) get caught here because the compounding is most visible.

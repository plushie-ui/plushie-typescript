# Resilience

plushie-typescript is meant to behave predictably when things go
wrong: an exception in a handler, an unhandled rejection in an async
command, a malformed wire message from the renderer, the renderer
process crashing, a broken pipe, a `view` that throws, a subscription
source that explodes. Resilience here is graceful behavior under
those conditions, not hardening against an attacker; that
distinction lives in `trust-model.md`.

The user-facing promise is the host SDK's half of the broader
plushie promise: a renderer crash auto-recovers with state re-sync,
an app exception reverts to the last good state, neither side takes
the other down. This doc describes how plushie-typescript holds up
that half.

## What resilience means here

- **Handler/update/view exception revert.** Throws inside `init`,
  `update`, `view`, and inline widget handlers are caught by the
  runtime, logged, and the model reverts to its pre-call state.
  The user does not need to wrap callbacks in try/catch.
- **Rate-limited error logging.** Repeated errors do not flood the
  console. Full trace for the first batch, debug-level for the
  next, suppressed thereafter with a periodic reminder. The next
  clean call does not by itself clear the suppression; the
  suppression unwinds on its own schedule so a flood does not
  leave the next innocent error invisible.
- **Promise-from-handler detection.** Returning a Promise from a
  widget handler or `update` is a programming error (the
  Elm-architecture contract is synchronous; async work goes through
  `Command.async`). The runtime detects the returned Promise and
  surfaces a clear error explaining `Command.async`. This is a DX
  promise as much as a resilience one; see `goals-and-non-goals.md`.
- **Renderer crash auto-recovery.** The transport owns the binary
  child process. On unexpected exit it notifies the runtime, which
  drives a fresh transport, replays settings, and sends a fresh
  full snapshot to re-sync the tree. The user's
  `handleRendererExit` callback can adjust the model before
  re-sync (e.g., reset transient UI state). Restart is
  unconditional: there is no backoff loop. If the binary cannot
  start, the runtime surfaces the failure and shuts down.
- **AbortController for async work.** Every `Command.async` and
  `Command.stream` gets an AbortController. `Command.cancel(tag)`
  fires `abort()` on the signal AND increments a nonce so stale
  results from the cancelled task are discarded if they still
  arrive. Tasks that respect the signal cancel cleanly; tasks that
  ignore it have their results silently dropped.
- **Microtask coalescing for high-frequency events.** Pointer
  moves, scroll, resize, and pane-resize events are buffered on a
  per-key map and flushed via `queueMicrotask`. Discrete events
  (click, input, etc.) flush the buffer first to preserve
  ordering. A malicious or buggy renderer flooding events does not
  starve the runtime.
- **Defensive parsing on the wire.** The codec assumes its input
  could be wrong: malformed MessagePack, unknown event variants,
  missing required fields, type-coercion mismatches. Rejection
  with a structured error is the right outcome; throwing without a
  context message is not.
- **Return-shape validation.** `init`, `update`, and inline
  handlers must return a bare model or a tuple of
  `[model, command | command[]]`. Anything else surfaces a
  TypeScript error at compile time (the `UpdateResult<S>` type)
  and a runtime error at execution if the user has bypassed the
  type system. See `elm-invariants.md`.
- **Subscription failure isolation.** A subscription source that
  throws does not take the runtime down. The error surfaces as a
  structured event through the normal dispatch path; the runtime's
  loop survives.
- **Model immutability in dev.** `deepFreeze` on the model after
  each update when `NODE_ENV !== 'production'` turns silent
  mutations into clear errors at the offending site. Stripped from
  production builds; `DeepReadonly<M>` carries the contract at
  compile time without the runtime cost.

## What is appropriate to fail fast on

Some conditions are not recoverable at the framework level and
should fail fast rather than degrade:

- **Programming errors that violate runtime invariants.** Wrong
  return shape from `init`/`update` that bypassed the type system,
  a widget builder that produced a non-`UINode`, a UI tree whose
  top level is not a window node. The right behavior is a clear
  error at the failing site, not silent fallback.
- **Unrecoverable startup.** If `resolveBinary` cannot find the
  renderer binary, the runtime surfaces the failure with a clear
  message and the download instructions. Attempting to operate
  without a renderer is not a degraded mode worth supporting.
- **Wire framing corruption.** A truncated or unparseable frame on
  the transport's input is not a recoverable condition; the
  transport surfaces it and closes.

The line: degrade gracefully on user-facing conditions (app code
errors, parse errors, transport hiccups, renderer crashes). Fail
fast on framework-level invariant violations.

## Patterns in the codebase

Worth maintaining as the project evolves:

- try/catch around `init`, `update`, `view`, and handler calls;
  revert-and-log on exception.
- Wire-edge validation in `client/protocol.ts`; structured errors,
  never silent passthrough of malformed input.
- Effect request tracking with timeout timers; stale responses
  dropped, in-flight responses correlated by wire ID.
- Transport restart with fresh snapshot re-sync rather than
  attempting to replay buffered events.
- `queueMicrotask` for coalescing high-frequency events so a
  flooding renderer cannot peg the event loop.
- AbortController on every async/stream command; nonce-based
  invalidation for tasks that ignore the signal.
- Rate-limited error logging with self-clearing suppression.
- `deepFreeze` in dev to convert silent mutation into a clear
  throw at the call site.

## What resilience is not

- **Not adversarial-input hardening.** The threat model is "things
  go wrong," not "attacker is trying to crash." Findings framed as
  the latter are usually misframed; see `trust-model.md`.
- **Not perfectionism.** The runtime does not try to fix the user's
  logic for them; it reverts and logs. The widget builders do not
  invent placeholders for missing types; they throw at the call
  site.
- **Not retry-at-any-cost.** A failed command surfaces a structured
  event; the user's `update` decides whether to retry. The runtime
  does not retry on its own.
- **Not defense against impossible states.** Adding a defensive
  branch for a condition that cannot occur given the surrounding
  invariants is accidental complexity, not resilience. The bar for
  "cannot occur" is reading the surrounding code and being
  confident in the invariant, not exhaustive proof.

## Implications

- A real things-go-wrong path producing an ungraceful failure (an
  unhandled rejection that crashes the runtime, a missed revert on
  view error, a stale effect tag delivering to the wrong handler,
  a transport that hangs instead of closing on broken pipe) is in
  scope today and earns priority.
- Inconsistency between resilience patterns (one site reverts on
  error, another swallows; one source logs and retries, another
  logs and gives up) is itself a resilience bug because future
  maintainers cannot predict behavior.
- Defensive layers for conditions that cannot occur given the
  surrounding invariants are out of scope; they add accidental
  complexity without reducing real failure modes.
- Aborting on conditions where graceful degradation is the right
  answer ("this should throw on bad event content") is the wrong
  direction; the established pattern is reject-and-report.
